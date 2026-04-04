import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { Bot } from "mineflayer";
import { WEB_PORT } from "./config.js";
import { log } from "./logger.js";
import { broadcast, setWss } from "./broadcast.js";

// ─── WebSocket サーバー ───────────────────────────────────
export function startWebSocketServer(bot: Bot): void {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("DonutSMP Bot WebSocket Server\n");
  });

  const wss = new WebSocketServer({ server });
  setWss(wss);

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
