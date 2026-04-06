import type { Bot } from "mineflayer";
import { log } from "./logger.js";
import {
  BOT_VIEWER_PORT,
  BOT_VIEWER_PREFIX,
  BOT_VIEWER_VIEW_DISTANCE,
  BOT_VIEWER_ENABLED,
} from "./config.js";
import { setViewerMode } from "./viewerState.js";

type ViewerBot = Bot & {
  viewer?: {
    close?: () => void;
  };
};

let activeBot: ViewerBot | null = null;
let viewerStarted = false;
let startingPromise: Promise<void> | null = null;

function isCanvasModuleMissingError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  if (!("code" in err) || err.code !== "MODULE_NOT_FOUND") return false;
  if (!("message" in err) || typeof err.message !== "string") return false;
  return err.message.includes("Cannot find module 'canvas'");
}

export async function startBotViewer(bot: Bot): Promise<void> {
  if (!BOT_VIEWER_ENABLED) {
    setViewerMode("disabled");
    return;
  }

  const viewerBot = bot as ViewerBot;
  if (activeBot === viewerBot && viewerStarted) {
    return;
  }

  if (startingPromise) {
    await startingPromise;
    if (activeBot === viewerBot && viewerStarted) {
      return;
    }
  }

  if (viewerStarted && activeBot && activeBot !== viewerBot) {
    if (activeBot.viewer?.close) {
      try {
        activeBot.viewer.close();
      } catch (err) {
        log.error("既存 Viewer の停止に失敗しました", err);
      }
    }
    viewerStarted = false;
  }

  startingPromise = (async () => {
    try {
      const prismarineViewer = await import("prismarine-viewer");
      prismarineViewer.mineflayer(viewerBot, {
        firstPerson: true,
        port: BOT_VIEWER_PORT,
        prefix: BOT_VIEWER_PREFIX,
        viewDistance: BOT_VIEWER_VIEW_DISTANCE,
      });
      activeBot = viewerBot;
      viewerStarted = true;
      setViewerMode("prismarine");
      log.info(
        `Bot Viewer 起動: http://localhost:${BOT_VIEWER_PORT}${BOT_VIEWER_PREFIX}/`,
      );
    } catch (err) {
      if (isCanvasModuleMissingError(err)) {
        setViewerMode("three");
        log.warn(
          "Bot Viewer switched to viewer-via-three because optional dependency 'canvas' is unavailable. Set BOT_VIEWER_ENABLED=false to disable all viewer rendering. / 'canvas' 依存が未導入のため Bot Viewer は viewer-via-three へフォールバックしました。すべての Viewer 表示を無効化するには BOT_VIEWER_ENABLED=false を設定してください。",
        );
        return;
      }
      log.error("Bot Viewer の起動に失敗しました", err);
    } finally {
      startingPromise = null;
    }
  })();

  await startingPromise;
}

export function notifyBotViewerBotEnded(bot: Bot): void {
  if (activeBot === (bot as ViewerBot) && viewerStarted) {
    log.info("Bot 切断を検知しました。Viewer サービスは維持し、次回接続時に Bot を切り替えます。");
  }
}
