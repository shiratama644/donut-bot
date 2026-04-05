"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import ChatPanel from "@/components/ChatPanel";
import StatusPanel from "@/components/StatusPanel";
import SettingsPanel from "@/components/SettingsPanel";
import LoginPanel from "@/components/LoginPanel";
import { useBotWebSocket } from "@/hooks/useBotWebSocket";
import { useTheme } from "@/hooks/useTheme";
import type { Position, BotStatusMessage } from "@/types/bot";

const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ??
  (typeof window !== "undefined"
    ? `ws://${window.location.hostname}:3000`
    : "ws://localhost:3000");

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
        onSubmit={(username) => ws.actions.sendSetCredentials(username)}
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
        onLogout={ws.actions.sendLogout}
        onSwitchAccount={ws.actions.sendSwitchAccount}
        onRemoveAccount={ws.actions.sendRemoveAccount}
      />
      <ChatPanel ws={ws} actions={ws.actions} />
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
        onSetCredentials={(username) => ws.actions.sendSetCredentials(username)}
      />
    </div>
  );
}
