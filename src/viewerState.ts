import { BOT_VIEWER_ENABLED } from "./config.js";
import { broadcast } from "./broadcast.js";

export type ViewerMode = "disabled" | "prismarine" | "three";

let viewerMode: ViewerMode = BOT_VIEWER_ENABLED ? "prismarine" : "disabled";

export function getViewerMode(): ViewerMode {
  return viewerMode;
}

export function setViewerMode(mode: ViewerMode): void {
  if (viewerMode === mode) return;
  viewerMode = mode;
  broadcast({ type: "viewerMode", mode });
}
