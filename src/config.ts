import path from "path";
import { getCredentials } from "./credentials.js";

// ─── 設定 ────────────────────────────────────────────────

/** createBot() を呼ぶたびに最新の認証情報でコンフィグを組み立てて返す */
export function getConfig() {
  const creds = getCredentials();
  if (!creds) throw new Error("認証情報が設定されていません。Web UI でアカウント情報を入力してください。");
  return {
    host:           process.env.HOST     ?? "donutsmp.net",
    port:           Number(process.env.PORT ?? 25565),
    username:       creds.username,
    auth:           (process.env.AUTH    ?? "microsoft") as "microsoft" | "offline",
    ...(creds.password ? { password: creds.password } : {}),
    version:        process.env.VERSION  ?? "1.21.1",
    // パスワードを渡さないことでデバイスコードフロー（ブラウザ認証）を使用する
    // 認証トークンのキャッシュ先はアカウントごとに分けることで、
    // アカウント切り替え時に別アカウントのトークンが使われないようにする
    profilesFolder: process.env.PROFILES_FOLDER ?? path.join(process.cwd(), ".cache", "profiles", creds.username),
  };
}

export const WEB_PORT = Number(process.env.WEB_PORT ?? 3000);
export const BOT_VIEWER_PORT = Number(process.env.BOT_VIEWER_PORT ?? 3002);
export const BOT_VIEWER_PREFIX = process.env.BOT_VIEWER_PREFIX ?? "/viewer";
export const BOT_VIEWER_VIEW_DISTANCE = Number(process.env.BOT_VIEWER_VIEW_DISTANCE ?? 6);
export const BOT_VIEWER_ENABLED = process.env.BOT_VIEWER_ENABLED !== "false";

/** 移動イベントのブロードキャスト最小間隔 (ms) */
export const MOVE_THROTTLE_MS = 150;

/** 座標をコンソールと WebSocket へ定期送信する間隔 (ms) */
export const COORD_DISPLAY_INTERVAL_MS = 500;
