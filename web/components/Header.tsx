"use client";

import type { Position } from "@/types/bot";

interface Props {
  position: Position | null;
  connected: boolean;
}

export default function Header({ position, connected }: Props) {
  const fmtNum = (n: number, w: number) => n.toFixed(1).padStart(w);

  const coordText = position
    ? `X: ${fmtNum(position.x, 8)}   Y: ${fmtNum(position.y, 6)}   Z: ${fmtNum(position.z, 8)}`
    : "X: —        Y: —      Z: —";

  return (
    <header
      style={{ backgroundColor: "var(--color-panel)", borderBottom: "1px solid var(--color-border)" }}
      className="flex items-center justify-between gap-3 px-4 py-2.5"
    >
      <span
        className="shrink-0 text-xl tracking-widest"
        style={{ fontFamily: "'VT323', monospace", color: "var(--color-yellow)" }}
      >
        ⛏ DonutSMP
      </span>

      <span
        className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs tracking-wide"
        style={{ color: "var(--color-green)" }}
      >
        {coordText}
      </span>

      <span
        className="size-2 shrink-0 rounded-full transition-colors duration-300"
        style={{
          backgroundColor: connected ? "var(--color-green)" : "var(--color-dim)",
          boxShadow: connected ? "0 0 6px var(--color-green)" : "none",
        }}
        aria-label={connected ? "オンライン" : "オフライン"}
      />
    </header>
  );
}
