"use client";

import { useState } from "react";

interface Props {
  onSubmit: (username: string, password: string) => void;
}

export default function LoginPanel({ onSubmit }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || submitting) return;
    setSubmitting(true);
    onSubmit(username.trim(), password);
  }

  return (
    <div className="login-overlay">
      <div className="login-card">
        <div className="login-card__logo">⛏</div>
        <h1 className="login-card__title">Donut Bot</h1>
        <p className="login-card__desc">Microsoftアカウントでログインしてください</p>
        <form className="login-card__form" onSubmit={handleSubmit}>
          <div className="login-card__field">
            <label className="login-card__label" htmlFor="login-username">
              メールアドレス
            </label>
            <input
              id="login-username"
              type="email"
              className="login-card__input"
              placeholder="your@email.com"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              disabled={submitting}
            />
          </div>
          <div className="login-card__field">
            <label className="login-card__label" htmlFor="login-password">
              パスワード
            </label>
            <input
              id="login-password"
              type="password"
              className="login-card__input"
              placeholder="パスワード（省略可 — デバイスコード認証）"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={submitting}
            />
            <p className="login-card__hint">
              省略するとデバイスコード認証になります（2FA対応）
            </p>
          </div>
          <button
            type="submit"
            className="login-card__submit"
            disabled={!username.trim() || submitting}
          >
            {submitting ? (
              <>
                <span className="material-symbols-outlined login-card__spin">refresh</span>
                接続中…
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">login</span>
                接続する
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
