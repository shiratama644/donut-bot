import { Bot } from "mineflayer";
import { broadcast } from "./broadcast.js";
import { COORD_DISPLAY_INTERVAL_MS } from "./config.js";

// ─── 座標表示 & ブロードキャスト ─────────────────────────
export function startCoordDisplay(bot: Bot): ReturnType<typeof setInterval> {
  return setInterval(() => {
    const pos = bot.entity?.position;
    if (!pos || isNaN(pos.x)) return;
    process.stdout.write(
      `\r[POS] X: ${pos.x.toFixed(2).padStart(9)}  Y: ${pos.y.toFixed(2).padStart(7)}  Z: ${pos.z.toFixed(2).padStart(9)}   `
    );
    broadcast({ type: "pos", x: pos.x, y: pos.y, z: pos.z });
  }, COORD_DISPLAY_INTERVAL_MS);
}
