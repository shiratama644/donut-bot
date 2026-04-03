"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import BotTerminal from "@/components/BotTerminal";
import DPad from "@/components/DPad";
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

  useEffect(() => {
    return ws.onMessage((msg) => {
      if (msg.type === "pos") {
        setPosition({ x: msg.x, y: msg.y, z: msg.z });
      }
    });
  }, [ws]);

  return (
    <div
      className="grid h-full"
      style={{
        gridTemplateRows: "auto 1fr",
        gridTemplateColumns: "1fr 280px",
        gridTemplateAreas: '"header header" "terminal controls"',
        gap: 1,
        backgroundColor: "var(--color-border)",
      }}
    >
      {/* ヘッダー */}
      <div style={{ gridArea: "header" }}>
        <Header position={position} connected={ws.connected} />
      </div>

      {/* ターミナル */}
      <div
        className="flex min-h-0 flex-col"
        style={{ gridArea: "terminal" }}
      >
        <BotTerminal ws={ws} actions={ws.actions} />
      </div>

      {/* コントロール */}
      <div style={{ gridArea: "controls" }}>
        <DPad actions={ws.actions} disabled={!ws.connected} />
      </div>
    </div>
  );
}
