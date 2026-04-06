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
  accounts: { username: string; mcid?: string }[];
  kickReason: string | null;
  onLogout: () => void;
  onSwitchAccount: (username: string) => void;
  onRemoveAccount: (username: string) => void;
  onReauthAccount: (username: string) => void;
}

export default function Header({ position, connected, botConnected, onToggleConnection, theme, onToggleTheme, onOpenStatus, onOpenSettings, currentUsername, accounts, kickReason, onLogout, onSwitchAccount, onRemoveAccount, onReauthAccount }: Props) {
  const fmt = (n: number) => n.toFixed(1);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const otherAccounts = accounts.filter((a) => a.username !== currentUsername);
  const currentAccount = accounts.find((a) => a.username === currentUsername);

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

      {!botConnected && kickReason && (
        <span
          className="app-header__kick-reason"
          title={kickReason}
          aria-label={`キック理由: ${kickReason}`}
        >
          <span className="material-symbols-outlined app-header__kick-reason-icon">report</span>
          {kickReason}
        </span>
      )}

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
              <span className="app-header__account-row-name">
                {currentUsername ?? "不明"}
                {currentAccount?.mcid && (
                  <span className="app-header__account-row-mcid"> ({currentAccount.mcid})</span>
                )}
              </span>
            </div>

            {/* その他のアカウント */}
            {otherAccounts.length > 0 && (
              <>
                <div className="app-header__account-divider" />
                <div className="app-header__account-section-label">アカウント切り替え</div>
                {otherAccounts.map((account) => (
                  <div key={account.username} className="app-header__account-row">
                    <button
                      type="button"
                      className="app-header__account-row-switch"
                      role="menuitem"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        onSwitchAccount(account.username);
                      }}
                      title={`${account.username} に切り替え`}
                    >
                      <span className="material-symbols-outlined app-header__account-row-icon">person_outline</span>
                      <span className="app-header__account-row-name">
                        {account.username}
                        {account.mcid && (
                          <span className="app-header__account-row-mcid"> ({account.mcid})</span>
                        )}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="app-header__account-row-reauth"
                      aria-label={`${account.username} を再認証`}
                      title="再認証（MCIDが違う場合に使用）"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        onReauthAccount(account.username);
                      }}
                    >
                      <span className="material-symbols-outlined">refresh</span>
                    </button>
                    <button
                      type="button"
                      className="app-header__account-row-remove"
                      aria-label={`${account.username} を削除`}
                      title="削除"
                      onClick={() => onRemoveAccount(account.username)}
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
              className="app-header__account-row-reauth app-header__account-reauth-current"
              role="menuitem"
              title="現在のアカウントを再認証（MCIDが違う場合に使用）"
              onClick={() => {
                setAccountMenuOpen(false);
                if (currentUsername) onReauthAccount(currentUsername);
              }}
              disabled={!currentUsername}
            >
              <span className="material-symbols-outlined">refresh</span>
              再認証
            </button>
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
