"use client";

interface Props {
  src: string;
  visible?: boolean;
}

export default function BotViewPanel({ src, visible = true }: Props) {
  if (!visible) return null;
  return (
    <section className="bot-view-panel" aria-label="Bot視点">
      <div className="bot-view-panel__header">
        <span className="material-symbols-outlined bot-view-panel__icon">videocam</span>
        <span>Bot 視点</span>
      </div>
      <div className="bot-view-panel__body">
        <iframe
          className="bot-view-panel__frame"
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
