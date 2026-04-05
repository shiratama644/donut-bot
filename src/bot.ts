import mineflayer, { Bot } from "mineflayer";
import { getConfig, MOVE_THROTTLE_MS } from "./config.js";
import { log } from "./logger.js";
import { broadcast } from "./broadcast.js";
import { startWebSocketServer, setBotConnected, clearBotRef, setBotConnecting } from "./websocketServer.js";
import { startCoordDisplay } from "./coordinates.js";
import { registerChatHandler } from "./chat.js";
import { startStatusBroadcast } from "./status.js";

// ─── Bot ─────────────────────────────────────────────────
export function createBot(): Bot {
  const config = getConfig();
  setBotConnecting();
  log.info(`接続中… host=${config.host} version=${config.version} auth=${config.auth}`);
  const bot = mineflayer.createBot(config);
  let coordTimer: ReturnType<typeof setInterval> | null = null;
  let stopStatus: (() => void) | null = null;

  bot.once("login", () =>
    log.info(`ログイン成功 — ユーザー名: ${bot.username}  EntityId: ${bot.entity?.id ?? "?"}`));

  bot.once("spawn", () => {
    log.info("スポーン完了。");
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
    // 意図的な切断（switchAccount / setCredentials）は once("end") リスナーが再接続を担当する。
    // 非意図的な切断（キック等）はユーザーが手動で Online ボタンを押して再接続する。
  });

  return bot;
}
