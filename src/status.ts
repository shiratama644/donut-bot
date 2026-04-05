import { Bot } from "mineflayer";
import { broadcast } from "./broadcast.js";

const DEFAULT_INTERVAL_MS = 2000;

// ─── インターバル管理 ──────────────────────────────────────
let statusHandle: ReturnType<typeof setInterval> | null = null;
let currentBot: Bot | null = null;
let currentIntervalMs = DEFAULT_INTERVAL_MS;

// 最後に有効だった値をキャッシュし、一時的に undefined になっても 0 へ戻らないようにする
let cache = {
  username: "",
  health: 0,
  food: 0,
  foodSaturation: 0,
  gameMode: "unknown",
  experienceLevel: 0,
  experiencePoints: 0,
  experienceProgress: 0,
  ping: 0,
};

function broadcastStatus(bot: Bot): void {
  // 有効な値のみキャッシュを上書きする
  if (bot.username)                          cache.username           = bot.username;
  if (bot.health != null)                    cache.health             = bot.health;
  if (bot.food != null)                      cache.food               = bot.food;
  if (bot.foodSaturation != null)            cache.foodSaturation     = bot.foodSaturation;
  if (bot.game?.gameMode)                    cache.gameMode           = bot.game.gameMode;
  if (bot.experience?.level != null)         cache.experienceLevel    = bot.experience.level;
  if (bot.experience?.points != null)        cache.experiencePoints   = bot.experience.points;
  if (bot.experience?.progress != null)      cache.experienceProgress = bot.experience.progress; // 次のレベルへの進捗 (0.0 〜 1.0)
  const ping = bot.player?.ping;
  if (ping != null && ping > 0)              cache.ping               = ping;

  broadcast({ type: "status", ...cache });
}

// ─── インターバル変更 ─────────────────────────────────────
export function setStatusIntervalMs(ms: number): void {
  currentIntervalMs = Math.max(10, Math.min(5000, ms));
  if (statusHandle !== null && currentBot !== null) {
    clearInterval(statusHandle);
    const bot = currentBot;
    statusHandle = setInterval(() => broadcastStatus(bot), currentIntervalMs);
  }
}

// ─── Status ブロードキャスト ──────────────────────────────
export function startStatusBroadcast(bot: Bot): () => void {
  currentBot = bot;
  statusHandle = setInterval(() => broadcastStatus(bot), currentIntervalMs);
  return () => {
    if (statusHandle !== null) {
      clearInterval(statusHandle);
      statusHandle = null;
    }
  };
}
