"use client";

import { useState, useEffect } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  intervalMs: number;
  onIntervalChange: (ms: number) => void;
  currentUsername: string | null;
  onSetCredentials: (username: string) => void;
}

export default function SettingsPanel({ open, onClose, intervalMs, onIntervalChange, currentUsername, onSetCredentials }: Props) {
  const [newUsername, setNewUsername] = useState("");

  // パネルを開くたびに現在のユーザー名をプリフィル
  useEffect(() => {
    if (open) {
      setNewUsername(currentUsername ?? "");
    }
  }, [open, currentUsername]);

  function handleSaveCredentials(e: React.FormEvent) {
    e.preventDefault();
    if (!newUsername.trim()) return;
    onSetCredentials(newUsername.trim());
    onClose();
  }

  return (
    <>
      {open && (
        <div
          className="settings-panel__overlay"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`settings-panel ${open ? "settings-panel--open" : ""}`}
        aria-label="設定"
        role="complementary"
      >
        <div className="settings-panel__header">
          <span className="settings-panel__title">
            <span className="material-symbols-outlined settings-panel__title-icon">settings</span>
            設定
          </span>
          <button
            type="button"
            className="settings-panel__close-btn"
            onClick={onClose}
            aria-label="閉じる"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="settings-panel__body">
          <div className="settings-panel__section-title">ステータス更新間隔</div>
          <div className="settings-panel__slider-row">
            <input
              type="range"
              min={10}
              max={5000}
              step={10}
              value={intervalMs}
              onChange={(e) => onIntervalChange(Number(e.target.value))}
              className="settings-panel__slider"
              aria-label="ステータス更新間隔"
            />
            <span className="settings-panel__slider-value">{intervalMs} ms</span>
          </div>
          <div className="settings-panel__slider-labels">
            <span>10 ms</span>
            <span>5000 ms</span>
          </div>

          <div className="settings-panel__divider" />

          <div className="settings-panel__section-title">アカウント</div>
          <form className="settings-panel__creds-form" onSubmit={handleSaveCredentials}>
            <div className="settings-panel__creds-field">
              <label className="settings-panel__creds-label" htmlFor="settings-username">
                メールアドレス
              </label>
              <input
                id="settings-username"
                type="email"
                className="settings-panel__creds-input"
                placeholder="your@email.com"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                autoComplete="username"
              />
              <p className="settings-panel__creds-hint">
                新しいアカウントの場合、再接続後にデバイスコードがこのページに表示されます
              </p>
            </div>
            <button
              type="submit"
              className="settings-panel__creds-btn"
              disabled={!newUsername.trim()}
            >
              <span className="material-symbols-outlined">sync</span>
              保存して再接続
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
