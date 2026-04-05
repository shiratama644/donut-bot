import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { Bot } from "mineflayer";
import { WEB_PORT } from "./config.js";
import { log, emit, ts } from "./logger.js";
import { broadcast, setWss } from "./broadcast.js";
import { setStatusIntervalMs } from "./status.js";

// ─── モジュールレベルの状態 ───────────────────────────────
let botRef: Bot | null = null;
let serverStarted = false;
let pendingIntentionalDisconnect = false;
let isBotConnected = false;
let reconnectCallback: (() => void) | null = null;

export function setReconnectCallback(fn: () => void): void {
  reconnectCallback = fn;
}

export function takePendingIntentionalDisconnect(): boolean {
  const val = pendingIntentionalDisconnect;
  pendingIntentionalDisconnect = false;
  return val;
}

export function setBotConnected(connected: boolean): void {
  isBotConnected = connected;
  broadcast({ type: "botConnection", connected });
}

// ─── WebSocket サーバー ───────────────────────────────────
export function startWebSocketServer(bot: Bot): void {
  botRef = bot;

  // 再接続時はサーバーを再起動しない
  if (serverStarted) return;
  serverStarted = true;

  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("DonutSMP Bot WebSocket Server\n");
  });

  const wss = new WebSocketServer({ server });
  setWss(wss);

  wss.on("connection", (ws) => {
    log.info("Web クライアント接続");

    // 接続時に現在のBot接続状態を送る
    ws.send(JSON.stringify({ type: "botConnection", connected: isBotConnected }));

    // 接続時に現在の座標を送る
    const pos = botRef?.entity?.position;
    if (pos && !isNaN(pos.x)) {
      ws.send(JSON.stringify({ type: "pos", x: pos.x, y: pos.y, z: pos.z }));
    }

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as Record<string, unknown>;
        handleClientMessage(ws, msg);
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

function handleClientMessage(ws: WebSocket, msg: Record<string, unknown>): void {
  if (msg.type === "chat" && typeof msg.text === "string" && msg.text.trim()) {
    if (!botRef) return;
    const text = msg.text.trim();
    botRef.chat(text);
    emit("send", `[SEND/WEB] ${text}`);
    broadcast({ type: "sent", text, time: ts() });
    return;
  }

  if (msg.type === "setStatusInterval" && typeof msg.ms === "number") {
    setStatusIntervalMs(msg.ms);
    return;
  }

  if (msg.type === "disconnect") {
    if (botRef && isBotConnected) {
      pendingIntentionalDisconnect = true;
      botRef.end("disconnected by user");
    }
    return;
  }

  if (msg.type === "reconnect") {
    if (!isBotConnected) {
      reconnectCallback?.();
    }
    return;
  }

  if (
    msg.type === "tabcomplete" &&
    typeof msg.text === "string" &&
    typeof msg.requestId === "number"
  ) {
    if (!botRef) return;
    const { text, requestId } = msg as { text: string; requestId: number };
    botRef.tabComplete(text)
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
