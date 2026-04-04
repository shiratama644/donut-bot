"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import ChatPanel from "@/components/ChatPanel";
import { useBotWebSocket } from "@/hooks/useBotWebSocket";
import type { Position } from "@/types/bot";

const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ??
  (typeof window !== "undefined"
    ? `ws://${window.location.hostname}:3000`
    : "ws://localhost:3000");

export default function HomePage() {
  const ws = useBotWebSocket(WS_URL);
  const [position, setPosition] = useState<Position | null>(null);

  const { onMessage } = ws;
  useEffect(() => {
    return onMessage((msg) => {
      if (msg.type === "pos") {
        setPosition({ x: msg.x, y: msg.y, z: msg.z });
      }
    });
  }, [onMessage]);

  return (
    <div
      className="flex h-full flex-col"
      style={{ gap: 1, backgroundColor: "var(--color-border)" }}
    >
      <Header position={position} connected={ws.connected} />
      <div className="flex min-h-0 flex-1 flex-col">
        <ChatPanel ws={ws} actions={ws.actions} />
      </div>
    </div>
  );
}
