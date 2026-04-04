"use client";

import type { Position } from "@/types/bot";
import type { Theme } from "@/hooks/useTheme";

interface Props {
  position: Position | null;
  connected: boolean;
  theme: Theme;
  onToggleTheme: () => void;
}

export default function Header({ position, connected, theme, onToggleTheme }: Props) {
  const fmt = (n: number) => n.toFixed(1);

  return (
    <header className="app-header" role="banner">
      <span className="app-header__icon">⛏</span>
      <span className="app-header__channel">minecraft</span>

      <div className="app-header__divider" />

      <div className="app-header__spacer" />

      {position ? (
        <div className="app-header__pos" aria-label="ボット座標">
          <span>X: {fmt(position.x)}</span>
          <span>Y: {fmt(position.y)}</span>
          <span>Z: {fmt(position.z)}</span>
        </div>
      ) : (
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>位置情報なし</span>
      )}

      <button
        type="button"
        className="app-header__theme-btn"
        onClick={onToggleTheme}
        aria-label={theme === "dark" ? "ライトテーマに切り替え" : "ダークテーマに切り替え"}
        title={theme === "dark" ? "ライトテーマに切り替え" : "ダークテーマに切り替え"}
      >
        {theme === "dark" ? "☀️" : "🌙"}
      </button>

      <span
        className={`app-header__status ${
          connected ? "app-header__status--online" : "app-header__status--offline"
        }`}
        aria-label={connected ? "オンライン" : "オフライン"}
        title={connected ? "接続中" : "切断中"}
      />
    </header>
  );
}
