"use client";

import { useCallback, useEffect, useRef } from "react";
import type { ControlKey } from "@/types/bot";
import type { BotWebSocketActions } from "@/hooks/useBotWebSocket";

interface Props {
  actions: BotWebSocketActions;
  disabled?: boolean;
}

interface ButtonDef {
  key: ControlKey;
  label: string;
  style?: React.CSSProperties;
  activeStyle?: React.CSSProperties;
}

const DPAD_BUTTONS: (ButtonDef | null)[] = [
  null,
  { key: "forward", label: "▲" },
  null,
  { key: "left", label: "◄" },
  null,
  { key: "right", label: "►" },
  { key: "back", label: "▼" },
  null,
  null,
];

const ACTION_BUTTONS: ButtonDef[] = [
  {
    key: "sneak",
    label: "▿",
  },
  {
    key: "jump",
    label: "⬆",
    style: { backgroundColor: "#1a1a2a", borderColor: "#4444aa" },
    activeStyle: { backgroundColor: "#22224a", borderColor: "#6666ff", color: "#6666ff" },
  },
  {
    key: "sprint",
    label: "»",
  },
];

const KEY_MAP: Record<string, ControlKey> = {
  w: "forward",
  s: "back",
  a: "left",
  d: "right",
  " ": "jump",
  Shift: "sneak",
  r: "sprint",
};

export default function DPad({ actions, disabled }: Props) {
  const pressedRef = useRef<Set<ControlKey>>(new Set());
  const activeRef = useRef<Map<ControlKey, HTMLElement>>(new Map());

  const press = useCallback((key: ControlKey, el?: HTMLElement | null) => {
    if (disabled) return;
    actions.sendKey(key, true);
    pressedRef.current.add(key);
    if (el) {
      el.dataset.active = "true";
      activeRef.current.set(key, el);
    }
  }, [actions, disabled]);

  const release = useCallback((key: ControlKey) => {
    actions.sendKey(key, false);
    pressedRef.current.delete(key);
    const el = activeRef.current.get(key);
    if (el) {
      delete el.dataset.active;
      activeRef.current.delete(key);
    }
  }, [actions]);

  // キーボードショートカット
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      const k = KEY_MAP[e.key];
      if (!k || pressedRef.current.has(k)) return;
      press(k);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = KEY_MAP[e.key];
      if (k) release(k);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [press, release]);

  const btnBase: React.CSSProperties = {
    backgroundColor: "var(--color-btn)",
    border: "1px solid var(--color-btn-border)",
    color: "var(--color-text)",
    borderRadius: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    userSelect: "none",
    fontFamily: "'VT323', monospace",
    fontSize: 22,
    width: 60,
    height: 60,
    transition: "background 0.1s, border-color 0.1s",
  };

  function makeHandlers(key: ControlKey) {
    return {
      onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
        e.preventDefault();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        press(key, e.currentTarget);
      },
      onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
        e.preventDefault();
        release(key);
      },
      onPointerCancel: (e: React.PointerEvent<HTMLButtonElement>) => {
        e.preventDefault();
        release(key);
      },
    };
  }

  return (
    <div
      className="flex flex-col items-center justify-center gap-5 p-4"
      style={{ backgroundColor: "var(--color-panel)", borderLeft: "1px solid var(--color-border)" }}
    >
      <span
        className="text-sm tracking-widest"
        style={{ fontFamily: "'VT323', monospace", color: "var(--color-dim)" }}
      >
        MOVE
      </span>

      {/* D-Pad */}
      <div className="grid grid-cols-3 gap-1" style={{ gridTemplateRows: "repeat(3, 60px)" }}>
        {DPAD_BUTTONS.map((btn, i) =>
          btn ? (
            <button
              key={btn.key}
              {...makeHandlers(btn.key)}
              style={{ ...btnBase, ...btn.style }}
              className="select-none data-[active]:border-[var(--color-green)] data-[active]:text-[var(--color-green)]"
              aria-label={btn.key}
            >
              {btn.label}
            </button>
          ) : (
            <span key={i} />
          )
        )}
      </div>

      {/* アクションボタン */}
      <div className="grid grid-cols-3 gap-1">
        {ACTION_BUTTONS.map((btn) => (
          <button
            key={btn.key}
            {...makeHandlers(btn.key)}
            style={{ ...btnBase, ...btn.style }}
            className="select-none data-[active]:border-[var(--color-green)] data-[active]:text-[var(--color-green)]"
            aria-label={btn.key}
          >
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
}
