"use client";

import { useState, useRef, useEffect } from "react";
import type { Position } from "@/types/bot";
import type { Theme } from "@/hooks/useTheme";

interface Props {
  position: Position | null;
  connected: boolean;
  botConnected: boolean;
  onToggleConnection: () => void;
  theme: Theme;
  onToggleTheme: () => void;
  onOpenStatus: () => void;
  onOpenSettings: () => void;
  currentUsername: string | null;
  accounts: string[];
  onLogout: () => void;
  onSwitchAccount: (username: string) => void;
  onRemoveAccount: (username: string) => void;
}

export default function Header({ position, connected, botConnected, onToggleConnection, theme, onToggleTheme, onOpenStatus, onOpenSettings, currentUsername, accounts, onLogout, onSwitchAccount, onRemoveAccount }: Props) {
  const fmt = (n: number) => n.toFixed(1);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const otherAccounts = accounts.filter((u) => u !== currentUsername);

  useEffect(() => {
    if (!accountMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [accountMenuOpen]);

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
          <span className="material-symbols-outlined app-header__pos-icon">location_on</span>
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

      <button
        type="button"
        className="app-header__status-badge"
        onClick={onToggleConnection}
        disabled={!connected}
        aria-label={botConnected ? "クリックして切断" : "クリックして再接続"}
        title={botConnected ? "クリックして切断" : "クリックして再接続"}
      >
        <span
          className={`app-header__status-dot ${
            botConnected
              ? "app-header__status-dot--online"
              : "app-header__status-dot--offline"
          }`}
        />
        {botConnected ? "Online" : "Offline"}
      </button>

      <button
        type="button"
        className="app-header__icon-btn"
        onClick={onToggleTheme}
        aria-label={theme === "dark" ? "ライトテーマに切り替え" : "ダークテーマに切り替え"}
        title={theme === "dark" ? "ライトテーマに切り替え" : "ダークテーマに切り替え"}
      >
        <span className="material-symbols-outlined">
          {theme === "dark" ? "light_mode" : "dark_mode"}
        </span>
      </button>

      <button
        type="button"
        className="app-header__icon-btn"
        onClick={onOpenSettings}
        aria-label="設定を開く"
        title="設定"
      >
        <span className="material-symbols-outlined">settings</span>
      </button>

      <button
        type="button"
        className="app-header__icon-btn"
        onClick={onOpenStatus}
        aria-label="ステータスメニューを開く"
        title="Bot Status"
      >
        <span className="material-symbols-outlined">monitor_heart</span>
      </button>

      <div className="app-header__account-wrapper" ref={menuRef}>
        <button
          type="button"
          className="app-header__icon-btn"
          onClick={() => setAccountMenuOpen((o) => !o)}
          aria-label="アカウントメニューを開く"
          aria-expanded={accountMenuOpen}
          title="アカウント"
        >
          <span className="material-symbols-outlined">account_circle</span>
        </button>

        {accountMenuOpen && (
          <div className="app-header__account-menu" role="menu">
            {/* 現在のアカウント */}
            <div className="app-header__account-section-label">ログイン中</div>
            <div className="app-header__account-row app-header__account-row--active">
              <span className="material-symbols-outlined app-header__account-row-icon">person</span>
              <span className="app-header__account-row-name">{currentUsername ?? "不明"}</span>
            </div>

            {/* その他のアカウント */}
            {otherAccounts.length > 0 && (
              <>
                <div className="app-header__account-divider" />
                <div className="app-header__account-section-label">アカウント切り替え</div>
                {otherAccounts.map((username) => (
                  <div key={username} className="app-header__account-row">
                    <button
                      type="button"
                      className="app-header__account-row-switch"
                      role="menuitem"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        onSwitchAccount(username);
                      }}
                      title={`${username} に切り替え`}
                    >
                      <span className="material-symbols-outlined app-header__account-row-icon">person_outline</span>
                      <span className="app-header__account-row-name">{username}</span>
                    </button>
                    <button
                      type="button"
                      className="app-header__account-row-remove"
                      aria-label={`${username} を削除`}
                      title="削除"
                      onClick={() => onRemoveAccount(username)}
                    >
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>
                ))}
              </>
            )}

            <div className="app-header__account-divider" />
            <button
              type="button"
              className="app-header__account-logout-btn"
              role="menuitem"
              onClick={() => {
                setAccountMenuOpen(false);
                onLogout();
              }}
            >
              <span className="material-symbols-outlined">logout</span>
              ログアウト
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
