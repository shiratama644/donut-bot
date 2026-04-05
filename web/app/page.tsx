"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import ChatPanel from "@/components/ChatPanel";
import StatusPanel from "@/components/StatusPanel";
import { useBotWebSocket } from "@/hooks/useBotWebSocket";
import { useTheme } from "@/hooks/useTheme";
import type { Position, BotStatusMessage } from "@/types/bot";

const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ??
  (typeof window !== "undefined"
    ? `ws://${window.location.hostname}:3000`
    : "ws://localhost:3000");

export default function HomePage() {
  const ws = useBotWebSocket(WS_URL);
  const [position, setPosition] = useState<Position | null>(null);
  const [botStatus, setBotStatus] = useState<BotStatusMessage | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const { onMessage } = ws;
  useEffect(() => {
    return onMessage((msg) => {
      if (msg.type === "pos") {
        setPosition({ x: msg.x, y: msg.y, z: msg.z });
      } else if (msg.type === "status") {
        setBotStatus(msg);
      }
    });
  }, [onMessage]);

  return (
    <div className="app-root">
      <Header
        position={position}
        connected={ws.connected}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenStatus={() => setStatusOpen(true)}
      />
      <ChatPanel ws={ws} actions={ws.actions} />
      <StatusPanel
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        status={botStatus}
      />
    </div>
  );
}
