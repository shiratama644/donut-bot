import { WebSocketServer, WebSocket } from "ws";

// ─── WebSocket ブロードキャスト ───────────────────────────
export let wss: WebSocketServer | undefined;

export function setWss(server: WebSocketServer): void {
  wss = server;
}

export function broadcast(data: object): void {
  const msg = JSON.stringify(data);
  wss?.clients.forEach((c) => {
    if (c.readyState === WebSocket.OPEN) c.send(msg);
  });
}
