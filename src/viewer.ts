import type { Bot } from "mineflayer";
import { log } from "./logger.js";
import {
  BOT_VIEWER_PORT,
  BOT_VIEWER_PREFIX,
  BOT_VIEWER_VIEW_DISTANCE,
} from "./config.js";

type ViewerBot = Bot & {
  viewer?: {
    close?: () => void;
  };
};

let activeViewerBot: ViewerBot | null = null;

export async function startBotViewer(bot: Bot): Promise<void> {
  const viewerBot = bot as ViewerBot;
  if (activeViewerBot === viewerBot && viewerBot.viewer?.close) {
    return;
  }
  if (activeViewerBot?.viewer?.close && activeViewerBot !== viewerBot) {
    try {
      activeViewerBot.viewer.close();
    } catch (err) {
      log.error("既存 Viewer の停止に失敗しました", err);
    }
  }
  activeViewerBot = viewerBot;

  try {
    const prismarineViewer = await import("prismarine-viewer");
    prismarineViewer.mineflayer(viewerBot, {
      firstPerson: true,
      port: BOT_VIEWER_PORT,
      prefix: BOT_VIEWER_PREFIX,
      viewDistance: BOT_VIEWER_VIEW_DISTANCE,
    });
    log.info(
      `Bot Viewer 起動: http://localhost:${BOT_VIEWER_PORT}${BOT_VIEWER_PREFIX}/`,
    );
  } catch (err) {
    log.error("Bot Viewer の起動に失敗しました", err);
  }
}

export function stopBotViewer(bot: Bot): void {
  const viewerBot = bot as ViewerBot;
  if (viewerBot.viewer?.close) {
    try {
      viewerBot.viewer.close();
    } catch (err) {
      log.error("Bot Viewer の停止に失敗しました", err);
    }
  }
  if (activeViewerBot === viewerBot) {
    activeViewerBot = null;
  }
}
