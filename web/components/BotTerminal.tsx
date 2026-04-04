"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  autoUpdate,
  flip,
  offset,
  size as sizeMiddleware,
  useFloating,
} from "@floating-ui/react";
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

// コマンド履歴をlocalStorageに保存・管理するフック
const HISTORY_KEY = "donut-bot-cmd-history";
const MAX_HISTORY = 30;

function useCommandHistory() {
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      if (saved) setHistory(JSON.parse(saved) as string[]);
    } catch {
      // ignore
    }
  }, []);

  const add = useCallback((cmd: string) => {
    setHistory((prev) => {
      const next = [cmd, ...prev.filter((c) => c !== cmd)].slice(0, MAX_HISTORY);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  return { history, add };
}

// タブ補完の選択時にカーソル位置にマッチを適用する
// 入力の最後のスペース以降をマッチで置き換え、先頭の "/" を保持する
function applyCompletion(currentInput: string, match: string): string {
  const lastSpace = currentInput.lastIndexOf(" ");
  if (lastSpace === -1) {
    // スペースなし: "/gam" → match="gamemode" → "/gamemode"
    const prefix = currentInput.startsWith("/") && !match.startsWith("/") ? "/" : "";
    return prefix + match;
  }
  // スペースあり: "/msg pla" → match="player1" → "/msg player1"
  return currentInput.slice(0, lastSpace + 1) + match;
}

type SuggestionMode = "history" | "tabcomplete";

export default function BotTerminal({ ws, actions }: Props) {
  const xtermRef = useRef<XTermHandle>(null);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { history, add: addToHistory } = useCommandHistory();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionMode, setSuggestionMode] = useState<SuggestionMode>("history");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const isOpen = suggestions.length > 0;
  const tabCompleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { onMessage, connected } = ws;

  // @floating-ui/react でドロップダウンを入力バーの上（スマホではキーボードの上）に配置する
  const { refs, floatingStyles } = useFloating({
    strategy: "fixed",
    placement: "top-start",
    middleware: [
      offset(2),
      flip({ padding: 8 }),
      sizeMiddleware({
        apply({ rects, availableHeight, elements }) {
          Object.assign(elements.floating.style, {
            width: `${rects.reference.width}px`,
            maxHeight: `${Math.min(availableHeight - 8, 240)}px`,
          });
        },
      }),
    ],
    whileElementsMounted: autoUpdate,
  });

  // メッセージを端末に書き込む
  useEffect(() => {
    return onMessage((msg) => {
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
  }, [onMessage]);

  // 接続/切断メッセージ
  useEffect(() => {
    const term = xtermRef.current;
    if (!term) return;
    if (connected) {
      term.writeln("\x1b[32m[SYS] 接続しました\x1b[0m");
    } else {
      term.writeln("\x1b[33m[SYS] 切断されました。再接続中…\x1b[0m");
    }
  }, [connected]);

  // タブ補完タイマーをクリーンアップ
  useEffect(() => {
    return () => {
      if (tabCompleteTimer.current) clearTimeout(tabCompleteTimer.current);
    };
  }, []);

  // 入力値に基づいて履歴サジェストを更新する（"/" なし入力用）
  const updateHistorySuggestions = useCallback(
    (value: string) => {
      if (!value.trim()) {
        setSuggestions([]);
        setHighlightedIndex(-1);
        return;
      }
      const lower = value.toLowerCase();
      const matches = history
        .filter((cmd) => cmd !== value && cmd.toLowerCase().startsWith(lower))
        .slice(0, 8);
      setSuggestions(matches);
      setSuggestionMode("history");
      setHighlightedIndex(-1);
    },
    [history],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setInput(val);

      if (tabCompleteTimer.current) clearTimeout(tabCompleteTimer.current);

      if (val.startsWith("/")) {
        // "/" から始まる入力: Minecraftサーバーにタブ補完をリクエスト（250ms デバウンス）
        setSuggestions([]);
        setHighlightedIndex(-1);
        tabCompleteTimer.current = setTimeout(() => {
          actions.requestTabComplete(val).then((matches) => {
            // レスポンスが届いた時点で入力が変わっていたら無視
            if (inputRef.current?.value === val) {
              setSuggestions(matches.slice(0, 10));
              setSuggestionMode("tabcomplete");
              setHighlightedIndex(-1);
            }
          });
        }, 250);
      } else {
        // 通常チャット: 履歴ベースの補完
        updateHistorySuggestions(val);
      }
    },
    [actions, updateHistorySuggestions],
  );

  // サジェストを選択して入力欄に反映する（送信はしない）
  const selectSuggestion = useCallback(
    (suggestion: string, mode: SuggestionMode, currentInput: string) => {
      const newInput =
        mode === "tabcomplete" ? applyCompletion(currentInput, suggestion) : suggestion;
      setInput(newInput);
      setSuggestions([]);
      setHighlightedIndex(-1);
      inputRef.current?.focus();
    },
    [],
  );

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    addToHistory(text);
    actions.sendChat(text);
    setInput("");
    setSuggestions([]);
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  }, [input, actions, addToHistory]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (isOpen) {
        // Enter: ハイライト中のサジェストがあれば補完、なければ送信
        if (e.key === "Enter" && highlightedIndex >= 0) {
          e.preventDefault();
          selectSuggestion(suggestions[highlightedIndex], suggestionMode, input);
          return;
        }
        if (e.key === "Escape") {
          setSuggestions([]);
          setHighlightedIndex(-1);
          return;
        }
      }
      if (e.key === "Enter" && !e.nativeEvent.isComposing) handleSend();
    },
    [isOpen, suggestions, highlightedIndex, suggestionMode, input, selectSuggestion, handleSend],
  );

  const handleBlur = useCallback(() => {
    // マウスクリックによる候補選択を妨げないよう少し遅延してから閉じる
    setTimeout(() => {
      setSuggestions([]);
      setHighlightedIndex(-1);
    }, 150);
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* xterm.js ターミナル */}
      <div className="min-h-0 flex-1 overflow-hidden" style={{ backgroundColor: "var(--color-panel)" }}>
        <XTerm ref={xtermRef} className="h-full w-full" />
      </div>

      {/* 予測変換ドロップダウン（@floating-ui/react により入力バーの上に固定配置） */}
      <ul
        ref={refs.setFloating}
        role="listbox"
        aria-label="予測変換候補"
        style={{
          ...floatingStyles,
          display: isOpen ? "block" : "none",
          overflowY: "auto",
          listStyle: "none",
          padding: "4px 0",
          margin: 0,
          border: "1px solid var(--color-border)",
          backgroundColor: "var(--color-panel)",
          zIndex: 100,
        }}
      >
        {suggestions.map((item, idx) => (
          <li
            key={item}
            role="option"
            aria-selected={highlightedIndex === idx}
            onMouseDown={(e) => {
              e.preventDefault(); // blur を防いで選択を確実にする
              selectSuggestion(item, suggestionMode, input);
            }}
            onMouseEnter={() => setHighlightedIndex(idx)}
            style={{
              padding: "6px 14px",
              cursor: "pointer",
              fontFamily: '"Share Tech Mono", monospace',
              fontSize: "0.875rem",
              color: highlightedIndex === idx ? "#0d0d0d" : "var(--color-text)",
              backgroundColor:
                highlightedIndex === idx ? "var(--color-green)" : "transparent",
            }}
          >
            {item}
          </li>
        ))}
      </ul>

      {/* チャット入力 */}
      <div
        ref={refs.setReference}
        className="flex"
        style={{ borderTop: "1px solid var(--color-border)", backgroundColor: "var(--color-panel)" }}
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder="/say こんにちは"
          autoComplete="new-password"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-form-type="other"
          data-lpignore="true"
          enterKeyHint="send"
          className="flex-1 bg-transparent px-3.5 py-3 text-sm outline-none placeholder:opacity-40"
          style={{
            fontFamily: '"Share Tech Mono", monospace',
            color: "var(--color-text)",
            borderRight: "1px solid var(--color-border)",
          }}
        />
        <button
          type="button"
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

