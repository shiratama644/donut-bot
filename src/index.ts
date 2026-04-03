import "dotenv/config";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer, WebSocket } from "ws";
import mineflayer, { Bot } from "mineflayer";
import readline from "readline";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── 設定 ────────────────────────────────────────────────
const CONFIG = {
  host:     process.env.HOST     ?? "donutsmp.net",
  port:     Number(process.env.PORT ?? 25565),
  username: process.env.USERNAME ?? (() => { throw new Error(".env に USERNAME が未設定です"); })(),
  auth:     (process.env.AUTH    ?? "microsoft") as "microsoft" | "offline",
  version:  process.env.VERSION  ?? "1.21.1",
} as const;

const WEB_PORT = Number(process.env.WEB_PORT ?? 3000);

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

// ─── WebSocket ブロードキャスト ───────────────────────────
let wss: WebSocketServer;

function broadcast(data: object) {
  const msg = JSON.stringify(data);
  wss?.clients.forEach((c) => {
    if (c.readyState === WebSocket.OPEN) c.send(msg);
  });
}

// ─── HTTP + WebSocket サーバー ────────────────────────────
function startWebServer(bot: Bot) {
  const htmlPath = path.join(__dirname, "public", "index.html");

  const server = http.createServer((_req, res) => {
    try {
      const html = fs.readFileSync(htmlPath, "utf-8");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });

  wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    log.info("Web クライアント接続");

    // 接続時に現在の座標を送る
    const pos = bot.entity?.position;
    if (pos && !isNaN(pos.x)) {
      ws.send(JSON.stringify({ type: "pos", x: pos.x, y: pos.y, z: pos.z }));
    }

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === "chat" && typeof msg.text === "string" && msg.text.trim()) {
          bot.chat(msg.text.trim());
          log.info(`[SEND/WEB] ${msg.text.trim()}`);
        }

        if (msg.type === "key" && typeof msg.key === "string" && typeof msg.state === "boolean") {
          const valid = ["forward","back","left","right","jump","sneak","sprint"] as const;
          type ControlKey = typeof valid[number];
          if ((valid as readonly string[]).includes(msg.key)) {
            bot.setControlState(msg.key as ControlKey, msg.state);
          }
        }
      } catch {
        // 無効なJSON無視
      }
    });

    ws.on("close", () => log.info("Web クライアント切断"));
  });

  server.listen(WEB_PORT, () => {
    log.info(`Web UI: http://localhost:${WEB_PORT}`);
  });
}

// ─── 座標表示 & ブロードキャスト ─────────────────────────
function startCoordDisplay(bot: Bot): ReturnType<typeof setInterval> {
  return setInterval(() => {
    const pos = bot.entity?.position;
    if (!pos || isNaN(pos.x)) return;
    process.stdout.write(
      `\r[POS] X: ${pos.x.toFixed(2).padStart(9)}  Y: ${pos.y.toFixed(2).padStart(7)}  Z: ${pos.z.toFixed(2).padStart(9)}   `
    );
    broadcast({ type: "pos", x: pos.x, y: pos.y, z: pos.z });
  }, 500);
}

// ─── ターミナルコマンド入力 ───────────────────────────────
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
    startWebServer(bot);
    coordTimer = startCoordDisplay(bot);
    startCommandInput(bot);
  });

  bot.on("message", (msg) => {
    const text = msg.toString();
    process.stdout.write("\n");
    log.info(`[CHAT] ${text}`);
    broadcast({ type: "chat", text, time: ts() });
  });

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
