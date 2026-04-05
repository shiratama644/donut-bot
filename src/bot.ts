import mineflayer, { Bot } from "mineflayer";
import { getConfig, MOVE_THROTTLE_MS } from "./config.js";
import { log } from "./logger.js";
import { broadcast } from "./broadcast.js";
import {
  startWebSocketServer,
  setBotConnected,
  clearBotRef,
  setBotConnecting,
  requestMcidReauth,
  beginAuthLifecycle,
  markAuthConnected,
  markAuthDisconnected,
} from "./websocketServer.js";
import { startCoordDisplay } from "./coordinates.js";
import { registerChatHandler } from "./chat.js";
import { startStatusBroadcast } from "./status.js";
import { getCredentials } from "./credentials.js";
import { getAccountEntry, updateAccountMcid, clearAccountProfileCache, getAccountEntries } from "./accounts.js";
import { getAuthState, setAuthState } from "./authState.js";

function createSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function resolveAuthSession(username: string): string {
  const current = getAuthState();
  if (
    current.username === username &&
    current.sessionId &&
    (current.state === "AUTHENTICATING" || current.state === "REAUTH_REQUIRED")
  ) {
    setAuthState({
      state: "AUTHENTICATING",
      username,
      sessionId: current.sessionId,
      nextRetryAt: null,
      reason: current.reason,
    });
    return current.sessionId;
  }
  const sessionId = createSessionId();
  beginAuthLifecycle(username, sessionId);
  return sessionId;
}

// ─── Bot ─────────────────────────────────────────────────
export function createBot(): Bot {
  const config = getConfig();
  const sessionId = resolveAuthSession(config.username);
  setBotConnecting();
  log.info(`接続中… host=${config.host} version=${config.version} auth=${config.auth}`);
  const bot = mineflayer.createBot({
    ...config,
    // Microsoft デバイスコードフローのコールバック。
    // 新しいアカウントの認証時にコードと URL を Web UI へ通知する。
    onMsaCode: (data: { user_code: string; verification_uri: string }) => {
      log.info(
        `Microsoft 認証が必要です — ${data.verification_uri} にアクセスしてコード ${data.user_code} を入力してください`,
      );
      broadcast({ type: "msaCode", userCode: data.user_code, verificationUri: data.verification_uri });
    },
  } as Parameters<typeof mineflayer.createBot>[0]);
  let coordTimer: ReturnType<typeof setInterval> | null = null;
  let stopStatus: (() => void) | null = null;

  bot.once("login", () => {
    const currentMcid = bot.username;
    const creds = getCredentials();
    if (creds?.username) {
      const stored = getAccountEntry(creds.username);
      if (stored?.mcid && stored.mcid !== currentMcid) {
        // キャッシュされたトークンが別アカウントのもの — キャッシュを削除して再認証する
        log.warn(
          `MCID 不一致 [${creds.username}] — 期待値: ${stored.mcid}, 実際: ${currentMcid}` +
          ` — トークンキャッシュをクリアして再認証します`,
        );
        clearAccountProfileCache(creds.username);
        requestMcidReauth(creds.username, {
          expected: stored.mcid,
          actual: currentMcid,
          sessionId,
        });
        bot.end("wrong mcid - reauthenticating");
        return;
      }
    }
    log.info(`ログイン成功 — ユーザー名: ${currentMcid}  EntityId: ${bot.entity?.id ?? "?"}`);
  });

  bot.once("spawn", () => {
    log.info("スポーン完了。");
    // MCID の保存は spawn 後に行う（ここを最終確定タイミングとする）
    const creds = getCredentials();
    const currentMcid = bot.username;
    if (creds?.username && currentMcid) {
      updateAccountMcid(creds.username, currentMcid);
      broadcast({ type: "accountsList", accounts: getAccountEntries() });
      markAuthConnected(creds.username, sessionId);
    }
    startWebSocketServer(bot);
    setBotConnected(true);
    coordTimer = startCoordDisplay(bot);
    stopStatus = startStatusBroadcast(bot);
  });

  // 移動のたびに座標をブロードキャスト（スロットリングで過剰送信を防止）
  let lastMoveBroadcast = 0;
  bot.on("move", () => {
    const now = Date.now();
    if (now - lastMoveBroadcast < MOVE_THROTTLE_MS) return;
    lastMoveBroadcast = now;
    const pos = bot.entity?.position;
    if (!pos || isNaN(pos.x)) return;
    broadcast({ type: "pos", x: pos.x, y: pos.y, z: pos.z });
  });

  registerChatHandler(bot);

  bot.on("kicked",   (reason, loggedIn) => {
    log.error(`キック (loggedIn=${loggedIn})`, { reason });
    // キック理由をパースして Web クライアントに通知する
    let kickText = reason;
    try {
      const parsed = JSON.parse(reason) as Record<string, unknown>;
      if (typeof parsed.text === "string") {
        kickText = parsed.text;
      } else if (typeof parsed.reason === "string") {
        const inner = JSON.parse(parsed.reason) as Record<string, unknown>;
        if (typeof inner.text === "string") kickText = inner.text;
      }
    } catch {
      // パース失敗時はそのまま使用
    }
    broadcast({ type: "kicked", reason: kickText });
  });
  bot.on("error",    (err) => log.error("エラー", err));
  bot.on("end",      (reason) => {
    if (coordTimer) clearInterval(coordTimer);
    if (stopStatus) stopStatus();
    process.stdout.write("\n");
    log.warn(`切断 — 理由: ${reason}`);
    clearBotRef(bot);
    setBotConnected(false);
    markAuthDisconnected(reason, getCredentials()?.username ?? null);
    // デバイスコード表示をクリアする（ログイン前に切断された場合もクリア）
    broadcast({ type: "msaCodeCleared" });
  });

  return bot;
}
