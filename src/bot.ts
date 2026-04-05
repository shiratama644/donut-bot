import mineflayer, { Bot } from "mineflayer";
import { CONFIG, MOVE_THROTTLE_MS } from "./config.js";
import { log } from "./logger.js";
import { broadcast } from "./broadcast.js";
import { startWebSocketServer } from "./websocketServer.js";
import { startCoordDisplay } from "./coordinates.js";
import { registerChatHandler } from "./chat.js";
import { startStatusBroadcast } from "./status.js";

// ─── Bot ─────────────────────────────────────────────────
export function createBot(): Bot {
  log.info(`接続中… host=${CONFIG.host} version=${CONFIG.version} auth=${CONFIG.auth}`);
  const bot = mineflayer.createBot(CONFIG);
  let coordTimer: ReturnType<typeof setInterval> | null = null;
  let stopStatus: (() => void) | null = null;

  bot.once("login", () =>
    log.info(`ログイン成功 — ユーザー名: ${bot.username}  EntityId: ${bot.entity?.id ?? "?"}`));

  bot.once("spawn", () => {
    log.info("スポーン完了。");
    startWebSocketServer(bot);
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

  bot.on("kicked",   (reason, loggedIn) => log.error(`キック (loggedIn=${loggedIn})`, { reason }));
  bot.on("error",    (err) => log.error("エラー", err));
  bot.on("end",      (reason) => {
    if (coordTimer) clearInterval(coordTimer);
    if (stopStatus) stopStatus();
    process.stdout.write("\n");
    log.warn(`切断 — 理由: ${reason}`);
    process.exit(0);
  });

  return bot;
}
