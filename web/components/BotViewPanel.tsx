"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface Props {
  src: string;
  visible?: boolean;
}

export default function BotViewPanel({ src, visible = true }: Props) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [isReady, setIsReady] = useState(false);

  const frameOrigin = useMemo(() => {
    try {
      return new URL(src, typeof window !== "undefined" ? window.location.href : "http://localhost").origin;
    } catch {
      return null;
    }
  }, [src]);

  const handleMessage = useCallback((event: MessageEvent) => {
    if (!frameOrigin || event.origin !== frameOrigin) return;
    if (event.data && typeof event.data === "object" && (event.data as { type?: unknown }).type === "viewer-ready") {
      setIsReady(true);
    }
  }, [frameOrigin]);

  useEffect(() => {
    if (!visible) return;
    setIsReady(false);
  }, [src, visible]);

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
          ref={frameRef}
          className="bot-view-panel__frame"
          style={{ opacity: isReady ? 1 : 0 }}
          src={src}
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
