"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  autoUpdate,
  flip,
  offset,
  size as sizeMiddleware,
  useFloating,
} from "@floating-ui/react";
import type { BotWebSocketActions, BotWebSocketState } from "@/hooks/useBotWebSocket";
import { useCommandHistory } from "@/hooks/useCommandHistory";
import { sanitizeForTerminal, formatMsgTime, applyCompletion } from "@/lib/terminal";

interface Props {
  ws: Pick<BotWebSocketState, "onMessage" | "connected">;
  actions: BotWebSocketActions;
}

// ─── ログエントリ型 ───────────────────────────────────────
type TerminalEntry =
  | { id: number; type: "log"; level: string; line: string }
  | { id: number; type: "chat" | "actionbar"; text: string; time?: string }
  | { id: number; type: "sys"; text: string; ok: boolean };

// ─── 定数 ────────────────────────────────────────────────
const LEVEL_COLOR: Record<string, string> = {
  info:  "var(--color-green)",
  warn:  "var(--color-yellow)",
  error: "var(--color-red)",
  send:  "#c678dd",
};

/** タブ補完リクエストのデバウンス遅延 (ms) */
const DEBOUNCE_TAB_COMPLETE_MS = 250;
/** 履歴サジェストの最大表示件数 */
const MAX_HISTORY_SUGGESTIONS = 8;
/** タブ補完サジェストの最大表示件数 */
const MAX_TAB_SUGGESTIONS = 10;
/** blur 後にドロップダウンを閉じるまでの遅延 (ms) — マウスクリック選択を妨げないため */
const BLUR_CLOSE_DELAY_MS = 150;
/** ログ表示の最大保持件数 */
const MAX_LOG_ENTRIES = 500;

// コンポーネントのライフタイムを超えてユニーク ID を保持するカウンター
let nextEntryId = 0;

// ─── 単一ログ行のレンダリング ─────────────────────────────
function EntryRow({ entry }: { entry: TerminalEntry }) {
  if (entry.type === "log") {
    return (
      <div style={{ color: LEVEL_COLOR[entry.level] ?? "var(--color-text)", wordBreak: "break-word" }}>
        {sanitizeForTerminal(entry.line)}
      </div>
    );
  }
  if (entry.type === "chat" || entry.type === "actionbar") {
    const isChat = entry.type === "chat";
    return (
      <div style={{ wordBreak: "break-word" }}>
        {entry.time && (
          <span style={{ color: "var(--color-dim)" }}>{formatMsgTime(entry.time)} </span>
        )}
        <span style={{ color: isChat ? "#56b6c2" : "var(--color-yellow)" }}>
          {isChat ? "[CHAT]" : "[ACTIONBAR]"}{" "}
        </span>
        <span style={{ color: "var(--color-text)" }}>{sanitizeForTerminal(entry.text)}</span>
      </div>
    );
  }
  // type === "sys"
  if (entry.type === "sys") {
    return (
      <div style={{ color: entry.ok ? "var(--color-green)" : "var(--color-yellow)" }}>
        {entry.text}
      </div>
    );
  }
  return null;
}

// ─── メインコンポーネント ─────────────────────────────────
type SuggestionMode = "history" | "tabcomplete";

export default function BotTerminal({ ws, actions }: Props) {
  const [entries, setEntries] = useState<TerminalEntry[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { history, add: addToHistory } = useCommandHistory();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionMode, setSuggestionMode] = useState<SuggestionMode>("history");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const isOpen = suggestions.length > 0;
  const tabCompleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { onMessage, connected } = ws;
  /** 履歴ナビゲーション中のインデックス (-1 = 現在の入力) */
  const [historyIdx, setHistoryIdx] = useState(-1);

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

  // ログエントリを追加し、上限を超えた分を先頭から削除する
  const addEntry = useCallback((entry: TerminalEntry) => {
    setEntries((prev) => {
      const next = [...prev, entry];
      return next.length > MAX_LOG_ENTRIES ? next.slice(next.length - MAX_LOG_ENTRIES) : next;
    });
  }, []);

  // 新しいエントリが追加されたら末尾へ自動スクロール
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "instant" });
  }, [entries]);

  // WebSocket メッセージをログエントリに変換して追加
  useEffect(() => {
    return onMessage((msg) => {
      if (msg.type === "log") {
        addEntry({ id: nextEntryId++, type: "log", level: msg.level, line: msg.line });
      } else if (msg.type === "chat" || msg.type === "actionbar") {
        addEntry({ id: nextEntryId++, type: msg.type, text: msg.text, time: msg.time });
      }
    });
  }, [onMessage, addEntry]);

  // 接続状態の変化をシステムメッセージとして表示
  useEffect(() => {
    addEntry({
      id: nextEntryId++,
      type: "sys",
      text: connected ? "[SYS] 接続しました" : "[SYS] 切断されました。再接続中…",
      ok: connected,
    });
  }, [connected, addEntry]);

  // タブ補完タイマーのクリーンアップ
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
        .slice(0, MAX_HISTORY_SUGGESTIONS);
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
      setHistoryIdx(-1);

      if (tabCompleteTimer.current) clearTimeout(tabCompleteTimer.current);

      if (val.startsWith("/")) {
        // "/" から始まる入力: Minecraftサーバーにタブ補完をリクエスト（デバウンス付き）
        setSuggestions([]);
        setHighlightedIndex(-1);
        tabCompleteTimer.current = setTimeout(() => {
          actions.requestTabComplete(val).then((matches) => {
            // レスポンスが届いた時点で入力が変わっていたら無視
            if (inputRef.current?.value === val) {
              setSuggestions(matches.slice(0, MAX_TAB_SUGGESTIONS));
              setSuggestionMode("tabcomplete");
              setHighlightedIndex(-1);
            }
          });
        }, DEBOUNCE_TAB_COMPLETE_MS);
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
    setHistoryIdx(-1);
    inputRef.current?.focus();
  }, [input, actions, addToHistory]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (isOpen) {
        // サジェストドロップダウンが開いている場合のキー操作
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setHighlightedIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setHighlightedIndex((i) => (i >= suggestions.length - 1 ? 0 : i + 1));
          return;
        }
        if (e.key === "Tab") {
          e.preventDefault();
          const idx = highlightedIndex >= 0 ? highlightedIndex : 0;
          selectSuggestion(suggestions[idx], suggestionMode, input);
          return;
        }
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

      if (!isOpen) {
        // サジェストが閉じている場合: 矢印キーでコマンド履歴を辿る
        if (e.key === "ArrowUp") {
          e.preventDefault();
          const nextIdx = Math.min(historyIdx + 1, history.length - 1);
          if (history[nextIdx] !== undefined) {
            setHistoryIdx(nextIdx);
            setInput(history[nextIdx]);
          }
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          if (historyIdx > 0) {
            const nextIdx = historyIdx - 1;
            setHistoryIdx(nextIdx);
            setInput(history[nextIdx]);
          } else if (historyIdx === 0) {
            setHistoryIdx(-1);
            setInput("");
          }
          return;
        }
      }

      if (e.key === "Enter" && !e.nativeEvent.isComposing) handleSend();
    },
    [isOpen, suggestions, highlightedIndex, suggestionMode, input, selectSuggestion, handleSend, history, historyIdx],
  );

  const handleBlur = useCallback(() => {
    // マウスクリックによる候補選択を妨げないよう少し遅延してから閉じる
    setTimeout(() => {
      setSuggestions([]);
      setHighlightedIndex(-1);
    }, BLUR_CLOSE_DELAY_MS);
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* ログ表示エリア */}
      <div
        className="min-h-0 flex-1 overflow-y-auto"
        style={{
          backgroundColor: "var(--color-panel)",
          padding: "8px 12px",
          fontFamily: '"Share Tech Mono", monospace',
          fontSize: "13px",
          lineHeight: "1.6",
        }}
      >
        {entries.map((entry) => (
          <EntryRow key={entry.id} entry={entry} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* 予測変換ドロップダウン（@floating-ui/react により入力バーの上に固定配置） */}
      <ul
        ref={refs.setFloating}
        role="listbox"
        aria-label="候補"
        style={{
          ...floatingStyles,
          display: isOpen ? "block" : "none",
          overflowY: "auto",
          listStyle: "none",
          padding: "4px 0",
          margin: 0,
          border: "1px solid var(--color-border)",
          backgroundColor: "var(--color-panel)",
          fontFamily: '"Share Tech Mono", monospace',
          fontSize: "0.875rem",
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
              color: highlightedIndex === idx ? "#0d0d0d" : "var(--color-text)",
              backgroundColor: highlightedIndex === idx ? "var(--color-green)" : "transparent",
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
          name="chat-input"
          inputMode="text"
          aria-label="チャット入力"
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder="/say こんにちは"
          autoComplete="new-password"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
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

