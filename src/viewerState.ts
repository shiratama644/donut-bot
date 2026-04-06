import { broadcast } from "./broadcast.js";

export type ViewerMode = "disabled" | "pending" | "prismarine" | "three";

let viewerMode: ViewerMode = "pending";

export function getViewerMode(): ViewerMode {
  return viewerMode;
}

export function setViewerMode(mode: ViewerMode): void {
  if (viewerMode === mode) return;
  viewerMode = mode;
  broadcast({ type: "viewerMode", mode });
}
