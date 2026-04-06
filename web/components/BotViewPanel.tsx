"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface Props {
  src: string;
  visible?: boolean;
  requireReadySignal?: boolean;
}

export default function BotViewPanel({ src, visible = true, requireReadySignal = false }: Props) {
  const [isReady, setIsReady] = useState(false);

  const frameSrc = useMemo(() => {
    const url = new URL(src, window.location.href);
    if (!requireReadySignal) return url.toString();
    url.searchParams.set("parentOrigin", window.location.origin);
    return url.toString();
  }, [requireReadySignal, src]);

  const frameOrigin = useMemo(() => {
    try {
      return new URL(frameSrc).origin;
    } catch {
      return null;
    }
  }, [frameSrc]);

  const handleMessage = useCallback((event: MessageEvent) => {
    if (!frameOrigin || event.origin !== frameOrigin) return;
    if (event.data && typeof event.data === "object" && (event.data as { type?: unknown }).type === "viewer-ready") {
      setIsReady(true);
    }
  }, [frameOrigin]);

  const handleFrameLoad = useCallback(() => {
    if (!requireReadySignal) {
      setIsReady(true);
    }
  }, [requireReadySignal]);

  useEffect(() => {
    if (!visible) return;
    setIsReady(false);
  }, [frameSrc, visible]);

  useEffect(() => {
    if (!visible) return;
    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [handleMessage, visible]);

  if (!visible) return null;
  return (
    <section className="bot-view-panel" aria-label="Bot視点">
      <div className="bot-view-panel__header">
        <span className="material-symbols-outlined bot-view-panel__icon">videocam</span>
        <span>Bot 視点</span>
      </div>
      <div className="bot-view-panel__body">
        {!isReady && (
          <div className="bot-view-panel__placeholder" role="status" aria-live="polite">
            Viewer を読み込み中です…
          </div>
        )}
        <iframe
          className="bot-view-panel__frame"
          style={{ opacity: isReady ? 1 : 0 }}
          src={frameSrc}
          onLoad={handleFrameLoad}
          title="Bot viewer"
          loading="lazy"
          allow="fullscreen"
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-pointer-lock"
        />
      </div>
    </section>
  );
}
