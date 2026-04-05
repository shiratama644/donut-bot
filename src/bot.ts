import mineflayer, { Bot } from "mineflayer";
import { getConfig, MOVE_THROTTLE_MS } from "./config.js";
import { log } from "./logger.js";
import { broadcast } from "./broadcast.js";
import { startWebSocketServer, setBotConnected, clearBotRef, setBotConnecting, requestMcidReauth } from "./websocketServer.js";
import { startCoordDisplay } from "./coordinates.js";
import { registerChatHandler } from "./chat.js";
import { startStatusBroadcast } from "./status.js";
import { getCredentials } from "./credentials.js";
import { getAccountEntry, updateAccountMcid, clearAccountProfileCache, getAccountEntries } from "./accounts.js";

// ─── Bot ─────────────────────────────────────────────────
export function createBot(): Bot {
  const config = getConfig();
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

  /**
   * MCID 不一致が検出された場合に spawn イベント内でこの理由で bot.end() を呼ぶ。
   * setTimeout に依存せず、mineflayer のイベントシーケンスに沿った安全なタイミングで
   * 切断を行うことでレースコンディションを回避する。
   */
  let pendingEndReason: string | null = null;
  /** login イベントで確認した実際の MCID（spawn でのMCID保存に使用） */
  let loginMcid: string | null = null;
  /** MCID 不一致時に end ハンドラから requestMcidReauth() を呼ぶためのアカウント名 */
  let pendingReauthUsername: string | null = null;

  bot.once("login", () => {
    loginMcid = bot.username;
    const creds = getCredentials();
    if (creds?.username) {
      const stored = getAccountEntry(creds.username);
      if (stored?.mcid && stored.mcid !== loginMcid) {
        // キャッシュされたトークンが別アカウントのもの — キャッシュを削除して再認証する
        log.warn(
          `MCID 不一致 [${creds.username}] — 期待値: ${stored.mcid}, 実際: ${loginMcid}` +
          ` — トークンキャッシュをクリアして再認証します`,
        );
        broadcast({ type: "wrongMcid", expected: stored.mcid, actual: loginMcid });
        clearAccountProfileCache(creds.username);
        pendingEndReason = "wrong mcid - reauthenticating";
        pendingReauthUsername = creds.username;
        return;
      }
    }
    log.info(`ログイン成功 — ユーザー名: ${loginMcid}  EntityId: ${bot.entity?.id ?? "?"}`);
  });

  bot.once("spawn", () => {
    // MCID 不一致が検出されていた場合は spawn 時点（状態が安定したタイミング）で切断する。
    // setTimeout ではなくここで切断することでレースコンディションを回避する。
    if (pendingEndReason) {
      bot.end(pendingEndReason);
      return;
    }

    log.info("スポーン完了。");
    // MCID の保存は spawn 後に行う（login 直後はゲーム内状態が確定していないため）
    const creds = getCredentials();
    if (creds?.username && loginMcid) {
      updateAccountMcid(creds.username, loginMcid);
      broadcast({ type: "accountsList", accounts: getAccountEntries() });
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
    // デバイスコード表示をクリアする（ログイン前に切断された場合もクリア）
    broadcast({ type: "msaCodeCleared" });
    // 意図的な切断（switchAccount / setCredentials）は once("end") リスナーが再接続を担当する。
    // 非意図的な切断（キック等）はユーザーが手動で Online ボタンを押して再接続する。
    // MCID 不一致による切断はキャッシュクリア後に自動再接続して正しいアカウントで認証し直す。
    // requestMcidReauth は試行回数を追跡し、上限到達時は再接続せずにエラーを通知する。
    if (reason === "wrong mcid - reauthenticating" && pendingReauthUsername) {
      requestMcidReauth(pendingReauthUsername);
    }
  });

  return bot;
}
