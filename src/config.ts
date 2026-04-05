// ─── 設定 ────────────────────────────────────────────────
export const CONFIG = {
  host:     process.env.HOST     ?? "donutsmp.net",
  port:     Number(process.env.PORT ?? 25565),
  username: process.env.BOT_USERNAME ?? (() => { throw new Error(".env に BOT_USERNAME が未設定です"); })(),
  auth:     (process.env.AUTH    ?? "microsoft") as "microsoft" | "offline",
  version:  process.env.VERSION  ?? "1.21.1",
} as const;

export const WEB_PORT = Number(process.env.WEB_PORT ?? 3000);

/** 移動イベントのブロードキャスト最小間隔 (ms) */
export const MOVE_THROTTLE_MS = 150;

/** 座標をコンソールと WebSocket へ定期送信する間隔 (ms) */
export const COORD_DISPLAY_INTERVAL_MS = 500;
