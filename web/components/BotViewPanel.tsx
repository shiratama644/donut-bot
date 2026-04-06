"use client";

interface Props {
  src: string;
}

export default function BotViewPanel({ src }: Props) {
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
          loading="eager"
          allow="fullscreen"
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-pointer-lock"
        />
      </div>
    </section>
  );
}
