"use client";

import type { Position } from "@/types/bot";

interface Props {
  position: Position | null;
  connected: boolean;
}

export default function Header({ position, connected }: Props) {
  const fmt = (n: number) => n.toFixed(1);

  return (
    <header
      style={{ backgroundColor: "var(--color-panel)", borderBottom: "1px solid var(--color-border)" }}
      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2.5"
    >
      <span
        className="shrink-0 text-xl tracking-widest"
        style={{ fontFamily: "'VT323', monospace", color: "var(--color-yellow)" }}
      >
        ⛏ DonutSMP
      </span>

      {position ? (
        <span
          className="flex gap-3 text-xs tracking-wide"
          style={{ color: "var(--color-green)" }}
        >
          <span>X: {fmt(position.x)}</span>
          <span>Y: {fmt(position.y)}</span>
          <span>Z: {fmt(position.z)}</span>
        </span>
      ) : (
        <span className="text-xs tracking-wide" style={{ color: "var(--color-dim)" }}>
          X: — &nbsp; Y: — &nbsp; Z: —
        </span>
      )}

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
