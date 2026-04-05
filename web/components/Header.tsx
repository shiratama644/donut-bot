"use client";

import type { Position } from "@/types/bot";
import type { Theme } from "@/hooks/useTheme";

interface Props {
  position: Position | null;
  connected: boolean;
  theme: Theme;
  onToggleTheme: () => void;
  onOpenStatus: () => void;
}

export default function Header({ position, connected, theme, onToggleTheme, onOpenStatus }: Props) {
  const fmt = (n: number) => n.toFixed(1);

  return (
    <header className="app-header" role="banner">
      <div className="app-header__brand">
        <div className="app-header__logo">⛏</div>
        <div>
          <div className="app-header__title">Donut Bot</div>
          <div className="app-header__subtitle">Minecraft Controller</div>
        </div>
      </div>

      <div className="app-header__spacer" />

      {position && (
        <div className="app-header__pos" aria-label="ボット座標">
          <span className="app-header__pos-label">X</span>
          {fmt(position.x)}
          <span className="app-header__pos-sep">·</span>
          <span className="app-header__pos-label">Y</span>
          {fmt(position.y)}
          <span className="app-header__pos-sep">·</span>
          <span className="app-header__pos-label">Z</span>
          {fmt(position.z)}
        </div>
      )}

      <div
        className="app-header__status-badge"
        aria-label={connected ? "接続中" : "切断中"}
        title={connected ? "接続中" : "切断中"}
      >
        <span
          className={`app-header__status-dot ${
            connected
              ? "app-header__status-dot--online"
              : "app-header__status-dot--offline"
          }`}
        />
        {connected ? "Online" : "Offline"}
      </div>

      <button
        type="button"
        className="app-header__theme-btn"
        onClick={onToggleTheme}
        aria-label={theme === "dark" ? "ライトテーマに切り替え" : "ダークテーマに切り替え"}
        title={theme === "dark" ? "ライトテーマに切り替え" : "ダークテーマに切り替え"}
      >
        {theme === "dark" ? "☀️" : "🌙"}
      </button>

      <button
        type="button"
        className="app-header__menu-btn"
        onClick={onOpenStatus}
        aria-label="ステータスメニューを開く"
        title="Bot Status"
      >
        <span className="app-header__menu-icon" aria-hidden="true" />
        <span className="app-header__menu-icon" aria-hidden="true" />
        <span className="app-header__menu-icon" aria-hidden="true" />
      </button>
    </header>
  );
}
