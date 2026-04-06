"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import ChatPanel from "@/components/ChatPanel";
import BotViewPanel from "@/components/BotViewPanel";
import StatusPanel from "@/components/StatusPanel";
import SettingsPanel from "@/components/SettingsPanel";
import LoginPanel from "@/components/LoginPanel";
import MsaCodeDisplay from "@/components/MsaCodeDisplay";
import { useBotWebSocket } from "@/hooks/useBotWebSocket";
import { useTheme } from "@/hooks/useTheme";
import type { Position, BotStatusMessage } from "@/types/bot";

const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ??
  (typeof window !== "undefined"
    ? `ws://${window.location.hostname}:3000`
    : "ws://localhost:3000");
const VIEWER_URL =
  process.env.NEXT_PUBLIC_BOT_VIEWER_URL ??
  (typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:3002/viewer/`
    : "http://localhost:3002/viewer/");

const DEFAULT_INTERVAL_MS = 2000;

export default function HomePage() {
  const ws = useBotWebSocket(WS_URL);
  const [position, setPosition] = useState<Position | null>(null);
  const [botStatus, setBotStatus] = useState<BotStatusMessage | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [intervalMs, setIntervalMs] = useState(DEFAULT_INTERVAL_MS);
  const { theme, toggleTheme } = useTheme();

  const { onMessage, botConnected } = ws;
  useEffect(() => {
    return onMessage((msg) => {
      if (msg.type === "pos") {
        setPosition({ x: msg.x, y: msg.y, z: msg.z });
      } else if (msg.type === "status") {
        setBotStatus(msg);
      }
    });
  }, [onMessage]);

  useEffect(() => {
    if (!botConnected) {
      setBotStatus(null);
      setPosition(null);
    }
  }, [botConnected]);

  function handleIntervalChange(ms: number) {
    setIntervalMs(ms);
    ws.actions.sendSetInterval(ms);
  }

  // 認証情報が未設定の場合はログイン画面を表示
  if (ws.hasCredentials === false) {
    return (
      <LoginPanel
        onSubmit={(username, password) => ws.actions.sendSetCredentials(username, password)}
        msaCode={ws.msaCode}
      />
    );
  }

  return (
    <div className="app-root">
      <Header
        position={position}
        connected={ws.connected}
        botConnected={ws.botConnected}
        onToggleConnection={() =>
          ws.botConnected ? ws.actions.sendDisconnect() : ws.actions.sendReconnect()
        }
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenStatus={() => setStatusOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        currentUsername={ws.currentUsername}
        accounts={ws.accounts}
        kickReason={ws.kickReason}
        onLogout={ws.actions.sendLogout}
        onSwitchAccount={ws.actions.sendSwitchAccount}
        onRemoveAccount={ws.actions.sendRemoveAccount}
        onReauthAccount={ws.actions.sendReauthAccount}
      />
      <main className="app-main-split">
        <section className="app-main-split__top">
          <ChatPanel ws={ws} actions={ws.actions} />
        </section>
        <section className="app-main-split__bottom">
          <BotViewPanel src={VIEWER_URL} />
        </section>
      </main>
      <StatusPanel
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        status={botStatus}
        position={position}
      />
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        intervalMs={intervalMs}
        onIntervalChange={handleIntervalChange}
        currentUsername={ws.currentUsername}
        onSetCredentials={(username, password) => ws.actions.sendSetCredentials(username, password)}
      />
      {ws.authState?.state === "REAUTH_REQUIRED" && ws.authState.expectedMcid && ws.authState.actualMcid && (
        <div className="notice-banner notice-banner--warn" role="alert">
          <span className="material-symbols-outlined notice-banner__icon">warning</span>
          <span>
            MCID 不一致を検出しました（期待値: <strong>{ws.authState.expectedMcid}</strong>、
            実際: <strong>{ws.authState.actualMcid}</strong>）。
            自動再認証を実行中です（{ws.authState.attempt}/{ws.authState.maxAttempts}）。
          </span>
        </div>
      )}
      {ws.authState?.state === "FAILED" && (() => {
        const failedUsername = ws.authState?.username;
        if (!failedUsername) return null;
        return (
          <div className="notice-banner notice-banner--error" role="alert">
            <span className="material-symbols-outlined notice-banner__icon">error</span>
            <span>
              <strong>{failedUsername}</strong> の自動再認証が上限回数に達しました。
              アカウントメニューから手動で「再認証」を実行してください。
            </span>
            <button
              type="button"
              className="notice-banner__dismiss"
              aria-label="閉じる"
              onClick={() => ws.actions.sendReauthAccount(failedUsername)}
            >
              <span className="material-symbols-outlined">refresh</span>
              再認証
            </button>
          </div>
        );
      })()}
      {ws.msaCode && (
        <div className="msa-code-overlay">
          <div className="msa-code-card">
            <MsaCodeDisplay
              userCode={ws.msaCode.userCode}
              verificationUri={ws.msaCode.verificationUri}
              variant="overlay"
            />
          </div>
        </div>
      )}
    </div>
  );
}
