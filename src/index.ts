import "dotenv/config";
import { log } from "./logger.js";
import { createBot } from "./bot.js";
import { setReconnectCallback, initWebSocketServer } from "./websocketServer.js";
import { loadCredentials } from "./credentials.js";
import { addOrUpdateAccount } from "./accounts.js";

process.on("uncaughtException",  (err) => { log.error("未処理の例外", err); process.exit(1); });
process.on("unhandledRejection", (r)   => { log.error("未処理のPromise拒否", r); process.exit(1); });

setReconnectCallback(() => createBot());

// 常に WebSocket サーバーを起動（認証情報がなくても Web UI からログインできるようにする）
initWebSocketServer();

const creds = loadCredentials();
if (creds) {
  // 起動時に読み込んだ認証情報をアカウント一覧にも登録する
  addOrUpdateAccount(creds);
  createBot();
} else {
  log.info("認証情報が未設定です。Web UI でアカウント情報を入力してください。");
}
