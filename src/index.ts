import "dotenv/config";
import mineflayer, { Bot } from "mineflayer";
import readline from "readline";

// ─── 設定（.envから読み込み）─────────────────────────────
const CONFIG = {
  host:     process.env.HOST     ?? "donutsmp.net",
  port:     Number(process.env.PORT ?? 25565),
  username: process.env.USERNAME ?? (() => { throw new Error(".env に USERNAME が未設定です"); })(),
  auth:     (process.env.AUTH    ?? "microsoft") as "microsoft" | "offline",
  version:  process.env.VERSION  ?? "1.21.1",
} as const;

// ─── ログ ────────────────────────────────────────────────
const log = {
  info:  (msg: string) => console.log (`[INFO]  ${ts()} ${msg}`),
  warn:  (msg: string) => console.warn (`[WARN]  ${ts()} ${msg}`),
  error: (msg: string, err?: unknown) => {
    console.error(`[ERROR] ${ts()} ${msg}`);
    if (err instanceof Error) {
      console.error(`        message : ${err.message}`);
      console.error(`        stack   : ${err.stack ?? "(no stack)"}`);
    } else if (err !== undefined) {
      console.error(`        detail  : ${JSON.stringify(err)}`);
    }
  },
};

function ts() {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

// ─── 座標表示 ─────────────────────────────────────────────
function startCoordDisplay(bot: Bot): ReturnType<typeof setInterval> {
  return setInterval(() => {
    const pos = bot.entity?.position;
    if (!pos || isNaN(pos.x)) return;
    process.stdout.write(
      `\r[POS] X: ${pos.x.toFixed(2).padStart(9)}  Y: ${pos.y.toFixed(2).padStart(7)}  Z: ${pos.z.toFixed(2).padStart(9)}   `
    );
  }, 500);
}

// ─── コマンド入力 ─────────────────────────────────────────
function startCommandInput(bot: Bot): void {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  rl.on("line", (line) => {
    const text = line.trim();
    if (!text) return;
    process.stdout.write("\n");
    try {
      bot.chat(text);
      log.info(`[SEND] ${text}`);
    } catch (err) {
      log.error("チャット送信失敗", err);
    }
  });

  rl.on("close", () => { bot.quit(); process.exit(0); });

  log.info("コマンド入力有効: テキストを入力してEnterで送信  [Ctrl+C] 終了");
}

// ─── Bot ─────────────────────────────────────────────────
function createBot(): Bot {
  log.info(`接続中… host=${CONFIG.host} version=${CONFIG.version} auth=${CONFIG.auth}`);
  const bot = mineflayer.createBot(CONFIG);
  let coordTimer: ReturnType<typeof setInterval> | null = null;

  bot.once("login", () =>
    log.info(`ログイン成功 — ユーザー名: ${bot.username}  EntityId: ${bot.entity?.id ?? "?"}`));

  bot.once("spawn", () => {
    log.info("スポーン完了。");
    coordTimer = startCoordDisplay(bot);
    startCommandInput(bot);
  });

  bot.on("message",  (msg) => { process.stdout.write("\n"); log.info(`[CHAT] ${msg.toString()}`); });
  bot.on("kicked",   (reason, loggedIn) => log.error(`キック (loggedIn=${loggedIn})`, { reason }));
  bot.on("error",    (err) => log.error("エラー", err));
  bot.on("end",      (reason) => {
    if (coordTimer) clearInterval(coordTimer);
    process.stdout.write("\n");
    log.warn(`切断 — 理由: ${reason}`);
    process.exit(0);
  });

  return bot;
}

process.on("uncaughtException",  (err) => { log.error("未処理の例外", err); process.exit(1); });
process.on("unhandledRejection", (r)   => { log.error("未処理のPromise拒否", r); process.exit(1); });

createBot();
