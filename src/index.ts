import "dotenv/config";
import { log } from "./logger.js";
import { createBot } from "./bot.js";

process.on("uncaughtException",  (err) => { log.error("未処理の例外", err); process.exit(1); });
process.on("unhandledRejection", (r)   => { log.error("未処理のPromise拒否", r); process.exit(1); });

createBot();
