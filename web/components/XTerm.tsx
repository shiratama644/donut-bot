"use client";

import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import type { ITerminalOptions } from "@xterm/xterm";

export interface XTermHandle {
  writeln: (text: string) => void;
  write: (text: string) => void;
  clear: () => void;
}

type PendingWrite = { method: "writeln" | "write"; text: string };

interface Props {
  options?: ITerminalOptions;
  className?: string;
}

const XTerm = forwardRef<XTermHandle, Props>(({ options, className }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<import("@xterm/xterm").Terminal | null>(null);
  const fitAddonRef = useRef<import("@xterm/addon-fit").FitAddon | null>(null);
  const pendingRef = useRef<PendingWrite[]>([]);

  useEffect(() => {
    let terminal: import("@xterm/xterm").Terminal;
    let fitAddon: import("@xterm/addon-fit").FitAddon;

    // Dynamic import to avoid SSR issues
    Promise.all([
      import("@xterm/xterm"),
      import("@xterm/addon-fit"),
    ]).then(([{ Terminal }, { FitAddon }]) => {
      if (!containerRef.current) return;

      terminal = new Terminal({
        fontFamily: '"Share Tech Mono", monospace',
        fontSize: 13,
        theme: {
          background: "#141414",
          foreground: "#d4d4d4",
          black: "#0d0d0d",
          green: "#39ff14",
          yellow: "#f0c040",
          red: "#ff4444",
          brightBlack: "#555555",
          cursor: "#39ff14",
          cursorAccent: "#0d0d0d",
          selectionBackground: "#2a2a2a",
        },
        cursorBlink: true,
        convertEol: true,
        scrollback: 500,
        ...options,
      });

      fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.open(containerRef.current);
      fitAddon.fit();

      termRef.current = terminal;
      fitAddonRef.current = fitAddon;

      // 初期化前にバッファされた書き込みをフラッシュ
      pendingRef.current.forEach(({ method, text }) => terminal[method](text));
      pendingRef.current = [];
    });

    const handleResize = () => fitAddonRef.current?.fit();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      termRef.current?.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
    // Terminal オプションは初期化時にのみ適用される。xterm.Terminal は初期化後に
    // オプションを動的に変更する API を持たないため、依存配列を意図的に空にしている。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    writeln: (text: string) => {
      if (termRef.current) {
        termRef.current.writeln(text);
      } else {
        pendingRef.current.push({ method: "writeln", text });
      }
    },
    write: (text: string) => {
      if (termRef.current) {
        termRef.current.write(text);
      } else {
        pendingRef.current.push({ method: "write", text });
      }
    },
    clear: () => termRef.current?.clear(),
  }));

  return <div ref={containerRef} className={className} />;
});

XTerm.displayName = "XTerm";

export default XTerm;
