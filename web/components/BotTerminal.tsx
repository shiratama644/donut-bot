"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import XTerm, { type XTermHandle } from "@/components/XTerm";
import type { BotWebSocketActions, BotWebSocketState } from "@/hooks/useBotWebSocket";

interface Props {
  ws: Pick<BotWebSocketState, "onMessage" | "connected">;
  actions: BotWebSocketActions;
}

const LEVEL_COLOR: Record<string, string> = {
  info:  "\x1b[32m",   // green
  warn:  "\x1b[33m",   // yellow
  error: "\x1b[31m",   // red
  chat:  "\x1b[36m",   // cyan
  send:  "\x1b[35m",   // magenta
};
const RESET = "\x1b[0m";

// 安全でないエスケープシーケンスを除去（OSC, DCS, PM, APC, SOS, CSI等すべて）
// 受信データは生テキストであることが期待されるため、エスケープシーケンスはすべて除去する
function sanitizeForTerminal(text: string): string {
  return text
    // OSC シーケンス: ESC ] ... ST or BEL
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, "")
    // DCS / PM / APC / SOS: ESC [P X ^ _] ... ST
    .replace(/\x1b[P_^X][^\x1b]*\x1b\\/g, "")
    // CSI シーケンス（カラーコード含む全 CSI）: ESC [ ... <final byte>
    .replace(/\x1b\[[\d;]*[\x40-\x7e]/g, "")
    // 残った裸の ESC シーケンス
    .replace(/\x1b[^[\]]/g, "");
}

export default function BotTerminal({ ws, actions }: Props) {
  const xtermRef = useRef<XTermHandle>(null);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // メッセージを端末に書き込む
  useEffect(() => {
    return ws.onMessage((msg) => {
      const term = xtermRef.current;
      if (!term) return;

      if (msg.type === "log") {
        const color = LEVEL_COLOR[msg.level] ?? "";
        term.writeln(`${color}${sanitizeForTerminal(msg.line)}${RESET}`);
      } else if (msg.type === "chat") {
        const time = msg.time ? `\x1b[90m${sanitizeForTerminal(msg.time.slice(11, 19))}\x1b[0m ` : "";
        term.writeln(`${time}\x1b[36m[CHAT]\x1b[0m ${sanitizeForTerminal(msg.text)}`);
      } else if (msg.type === "actionbar") {
        const time = msg.time ? `\x1b[90m${sanitizeForTerminal(msg.time.slice(11, 19))}\x1b[0m ` : "";
        term.writeln(`${time}\x1b[33m[ACTIONBAR]\x1b[0m ${sanitizeForTerminal(msg.text)}`);
      }
    });
  }, [ws]);

  // 接続/切断メッセージ
  useEffect(() => {
    const term = xtermRef.current;
    if (!term) return;
    if (ws.connected) {
      term.writeln("\x1b[32m[SYS] 接続しました\x1b[0m");
    } else {
      term.writeln("\x1b[33m[SYS] 切断されました。再接続中…\x1b[0m");
    }
  }, [ws.connected]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    actions.sendChat(text);
    setInput("");
    inputRef.current?.focus();
  }, [input, actions]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") handleSend();
    },
    [handleSend]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* xterm.js ターミナル */}
      <div className="min-h-0 flex-1 overflow-hidden" style={{ backgroundColor: "var(--color-panel)" }}>
        <XTerm ref={xtermRef} className="h-full w-full" />
      </div>

      {/* チャット入力 */}
      <div
        className="flex"
        style={{ borderTop: "1px solid var(--color-border)", backgroundColor: "var(--color-panel)" }}
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="/say こんにちは"
          autoComplete="off"
          enterKeyHint="send"
          className="flex-1 bg-transparent px-3.5 py-3 text-sm outline-none placeholder:opacity-40"
          style={{
            fontFamily: '"Share Tech Mono", monospace',
            color: "var(--color-text)",
            borderRight: "1px solid var(--color-border)",
          }}
        />
        <button
          onClick={handleSend}
          className="px-5 text-lg tracking-wide transition-colors duration-150"
          style={{
            fontFamily: "'VT323', monospace",
            color: "var(--color-green)",
            backgroundColor: "var(--color-btn)",
          }}
        >
          SEND
        </button>
      </div>
    </div>
  );
}
