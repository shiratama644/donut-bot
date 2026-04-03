import "dotenv/config";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import mineflayer, { Bot } from "mineflayer";

// ─── 設定 ────────────────────────────────────────────────
const CONFIG = {
  host:     process.env.HOST     ?? "donutsmp.net",
  port:     Number(process.env.PORT ?? 25565),
  username: process.env.USERNAME ?? (() => { throw new Error(".env に USERNAME が未設定です"); })(),
  auth:     (process.env.AUTH    ?? "microsoft") as "microsoft" | "offline",
  version:  process.env.VERSION  ?? "1.21.1",
} as const;

const WEB_PORT = Number(process.env.WEB_PORT ?? 3000);

// ─── 時刻 ────────────────────────────────────────────────
function ts(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

// ─── ログ ────────────────────────────────────────────────
type LogLevel = "info" | "warn" | "error" | "send";

const log = {
  info:  (msg: string) => emit("info",  `[INFO]  ${ts()} ${msg}`),
  warn:  (msg: string) => emit("warn",  `[WARN]  ${ts()} ${msg}`),
  error: (msg: string, err?: unknown) => {
    emit("error", `[ERROR] ${ts()} ${msg}`);
    if (err instanceof Error) {
      emit("error", `        message : ${err.message}`);
      emit("error", `        stack   : ${err.stack ?? "(no stack)"}`);
    } else if (err !== undefined) {
      emit("error", `        detail  : ${JSON.stringify(err)}`);
    }
  },
};

function emit(level: LogLevel, line: string): void {
  switch (level) {
    case "warn":  console.warn(line);  break;
    case "error": console.error(line); break;
    default:      console.log(line);   break;
  }
  broadcast({ type: "log", level, line });
}

// ─── WebSocket ブロードキャスト ───────────────────────────
let wss: WebSocketServer | undefined;

function broadcast(data: object): void {
  const msg = JSON.stringify(data);
  wss?.clients.forEach((c) => {
    if (c.readyState === WebSocket.OPEN) c.send(msg);
  });
}

// ─── WebSocket サーバー ───────────────────────────────────
function startWebSocketServer(bot: Bot): void {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("DonutSMP Bot WebSocket Server\n");
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
        const msg = JSON.parse(raw.toString()) as Record<string, unknown>;
        handleClientMessage(bot, ws, msg);
      } catch {
        // 無効なJSON無視
      }
    });

    ws.on("close", () => log.info("Web クライアント切断"));
  });

  server.listen(WEB_PORT, () => {
    log.info(`WebSocket サーバー起動: ws://localhost:${WEB_PORT}`);
  });
}

function handleClientMessage(bot: Bot, ws: WebSocket, msg: Record<string, unknown>): void {
  if (msg.type === "chat" && typeof msg.text === "string" && msg.text.trim()) {
    bot.chat(msg.text.trim());
    log.info(`[SEND/WEB] ${msg.text.trim()}`);
    return;
  }

  if (
    msg.type === "tabcomplete" &&
    typeof msg.text === "string" &&
    typeof msg.requestId === "number"
  ) {
    const { text, requestId } = msg as { text: string; requestId: number };
    bot.tabComplete(text)
      .then((matches) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "tabcomplete", requestId, matches: matches.map((m) => m.match) }));
        }
      })
      .catch(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "tabcomplete", requestId, matches: [] }));
        }
      });
  }
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

// ─── Bot ─────────────────────────────────────────────────
function createBot(): Bot {
  log.info(`接続中… host=${CONFIG.host} version=${CONFIG.version} auth=${CONFIG.auth}`);
  const bot = mineflayer.createBot(CONFIG);
  let coordTimer: ReturnType<typeof setInterval> | null = null;

  bot.once("login", () =>
    log.info(`ログイン成功 — ユーザー名: ${bot.username}  EntityId: ${bot.entity?.id ?? "?"}`));

  bot.once("spawn", () => {
    log.info("スポーン完了。");
    startWebSocketServer(bot);
    coordTimer = startCoordDisplay(bot);
  });

  // 移動のたびに座標をブロードキャスト（スロットリングで過剰送信を防止）
  let lastMoveBroadcast = 0;
  bot.on("move", () => {
    const now = Date.now();
    if (now - lastMoveBroadcast < 150) return;
    lastMoveBroadcast = now;
    const pos = bot.entity?.position;
    if (!pos || isNaN(pos.x)) return;
    broadcast({ type: "pos", x: pos.x, y: pos.y, z: pos.z });
  });

  bot.on("message", (msg, position) => {
    const text = msg.toString();
    process.stdout.write("\n");
    if (position === "game_info") {
      // アクションバーメッセージ（ホットバー上部のテキスト）
      broadcast({ type: "actionbar", text, time: ts() });
      emit("info", `[ACTIONBAR] ${text}`);
    } else {
      // NOTE: chat メッセージは { type:"chat", text, time } として独立ブロードキャストし、
      // クライアント側でチャット専用の表示を行う。emit() が送る { type:"log" } とは別扱い。
      // emit() を呼ぶと { type:"log" } も同時にブロードキャストされて二重表示になるため、
      // ここでは broadcast のみ行い、コンソール出力は console.log で行う。
      console.log(`[CHAT] ${ts()} ${text}`);
      broadcast({ type: "chat", text, time: ts() });
    }
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
