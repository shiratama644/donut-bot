import { Bot } from "mineflayer";
import { broadcast } from "./broadcast.js";

const STATUS_INTERVAL_MS = 2000;

function broadcastStatus(bot: Bot): void {
  broadcast({
    type: "status",
    username: bot.username,
    health: bot.health ?? 0,
    food: bot.food ?? 0,
    foodSaturation: bot.foodSaturation ?? 0,
    gameMode: bot.game?.gameMode ?? "unknown",
    experienceLevel: bot.experience?.level ?? 0,
    experiencePoints: bot.experience?.points ?? 0,
    ping: bot.player?.ping ?? 0,
  });
}

// ─── Status ブロードキャスト ──────────────────────────────
export function startStatusBroadcast(bot: Bot): ReturnType<typeof setInterval> {
  return setInterval(() => broadcastStatus(bot), STATUS_INTERVAL_MS);
}
