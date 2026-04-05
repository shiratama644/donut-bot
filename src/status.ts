import { Bot } from "mineflayer";
import { broadcast } from "./broadcast.js";

const STATUS_INTERVAL_MS = 2000;

// 最後に有効だった値をキャッシュし、一時的に undefined になっても 0 へ戻らないようにする
let cache = {
  username: "",
  health: 0,
  food: 0,
  foodSaturation: 0,
  gameMode: "unknown",
  experienceLevel: 0,
  experiencePoints: 0,
  ping: 0,
};

function broadcastStatus(bot: Bot): void {
  // 有効な値のみキャッシュを上書きする
  if (bot.username)                      cache.username        = bot.username;
  if (bot.health != null)                cache.health          = bot.health;
  if (bot.food != null)                  cache.food            = bot.food;
  if (bot.foodSaturation != null)        cache.foodSaturation  = bot.foodSaturation;
  if (bot.game?.gameMode)                cache.gameMode        = bot.game.gameMode;
  if (bot.experience?.level != null)     cache.experienceLevel = bot.experience.level;
  if (bot.experience?.points != null)    cache.experiencePoints = bot.experience.points;
  const ping = bot.player?.ping;
  if (ping != null && ping > 0)          cache.ping            = ping;

  broadcast({ type: "status", ...cache });
}

// ─── Status ブロードキャスト ──────────────────────────────
export function startStatusBroadcast(bot: Bot): ReturnType<typeof setInterval> {
  return setInterval(() => broadcastStatus(bot), STATUS_INTERVAL_MS);
}
