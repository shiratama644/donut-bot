"use client";

import { useState } from "react";
import MsaCodeDisplay from "@/components/MsaCodeDisplay";

interface Props {
  onSubmit: (username: string) => void;
  msaCode: { userCode: string; verificationUri: string } | null;
}

export default function LoginPanel({ onSubmit, msaCode }: Props) {
  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || submitting) return;
    setSubmitting(true);
    onSubmit(username.trim());
  }

  return (
    <div className="login-overlay">
      <div className="login-card">
        <div className="login-card__logo">⛏</div>
        <h1 className="login-card__title">Donut Bot</h1>
        <p className="login-card__desc">Microsoftアカウントでログインしてください</p>

        {msaCode ? (
          <MsaCodeDisplay
            userCode={msaCode.userCode}
            verificationUri={msaCode.verificationUri}
            variant="card"
          />
        ) : (
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
              <p className="login-card__hint">
                入力後、このページにデバイスコードが表示されます
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
                  デバイスコード待機中…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined">login</span>
                  接続する
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
