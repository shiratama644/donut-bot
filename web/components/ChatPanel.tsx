"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MainContainer,
  ChatContainer,
  MessageList,
  Message,
  MessageSeparator,
} from "@chatscope/chat-ui-kit-react";
import "@chatscope/chat-ui-kit-styles/dist/default/styles.min.css";
import type { BotWebSocketActions, BotWebSocketState } from "@/hooks/useBotWebSocket";
import { useMessageHistory } from "@/hooks/useMessageHistory";
import { sanitizeText, formatMsgTime, applyCompletion } from "@/lib/sanitize";

interface Props {
  ws: Pick<BotWebSocketState, "onMessage" | "connected">;
  actions: BotWebSocketActions;
}

// ─── メッセージエントリ型 ─────────────────────────────────
type ChatEntry =
  | { id: number; type: "log"; level: string; line: string }
  | { id: number; type: "chat" | "actionbar"; text: string; time?: string }
  | { id: number; type: "sys"; text: string; ok: boolean };

// ─── 定数 ────────────────────────────────────────────────
/** タブ補完リクエストのデバウンス遅延 (ms) */
const DEBOUNCE_TAB_COMPLETE_MS = 250;
/** 履歴サジェストの最大表示件数 */
const MAX_HISTORY_SUGGESTIONS = 8;
/** タブ補完サジェストの最大表示件数 */
const MAX_TAB_SUGGESTIONS = 10;
/** メッセージの最大保持件数 */
const MAX_ENTRIES = 500;

/** ログレベルのラベルと色 */
const LEVEL_STYLE: Record<string, { label: string; color: string }> = {
  info:  { label: "INFO", color: "var(--color-green)" },
  warn:  { label: "WARN", color: "var(--color-yellow)" },
  error: { label: "ERR",  color: "var(--color-red)" },
  send:  { label: "SEND", color: "#c678dd" },
};

// コンポーネントのライフタイムを超えてユニーク ID を保持するカウンター
let nextEntryId = 0;

// ─── 個別メッセージ行 ─────────────────────────────────────
type NonSysEntry = Exclude<ChatEntry, { type: "sys" }>;

function MessageRow({ entry }: { entry: NonSysEntry }) {
  if (entry.type === "log") {
    const s = LEVEL_STYLE[entry.level] ?? {
      label: entry.level.toUpperCase().slice(0, 4),
      color: "var(--color-text)",
    };
    return (
      <Message
        model={{ direction: "incoming", position: "single", type: "custom" }}
        avatarSpacer={false}
      >
        <Message.CustomContent>
          <span
            style={{
              color: s.color,
              fontWeight: "bold",
              display: "inline-block",
              minWidth: "2.6rem",
              marginRight: "0.6rem",
              letterSpacing: "0.04em",
            }}
          >
            {s.label}
          </span>
          <span style={{ wordBreak: "break-word" }}>{sanitizeText(entry.line)}</span>
        </Message.CustomContent>
      </Message>
    );
  }

  const isChat = entry.type === "chat";
  return (
    <Message
      model={{ direction: "incoming", position: "single", type: "custom" }}
      avatarSpacer={false}
    >
      <Message.CustomContent>
        {entry.time && (
          <span
            style={{
              color: "var(--color-dim)",
              fontSize: "0.72rem",
              marginRight: "0.5rem",
            }}
          >
            {formatMsgTime(entry.time)}
          </span>
        )}
        <span
          style={{
            color: isChat ? "#56b6c2" : "var(--color-yellow)",
            fontWeight: "bold",
            marginRight: "0.6rem",
            letterSpacing: "0.04em",
          }}
        >
          {isChat ? "CHAT" : "BAR"}
        </span>
        <span style={{ wordBreak: "break-word" }}>{sanitizeText(entry.text)}</span>
      </Message.CustomContent>
    </Message>
  );
}

// ─── メインコンポーネント ─────────────────────────────────
type SuggestionMode = "history" | "tabcomplete";

export default function ChatPanel({ ws, actions }: Props) {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { history, add: addToHistory } = useMessageHistory();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionMode, setSuggestionMode] = useState<SuggestionMode>("history");
  const isOpen = suggestions.length > 0;
  const tabCompleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { onMessage, connected } = ws;

  // エントリを追加し上限を超えたら先頭を削除
  const addEntry = useCallback((entry: ChatEntry) => {
    setEntries((prev) => {
      if (prev.length < MAX_ENTRIES) return [...prev, entry];
      return [...prev.slice(prev.length - MAX_ENTRIES + 1), entry];
    });
  }, []);

  // WebSocket メッセージをエントリに変換して追加
  useEffect(() => {
    return onMessage((msg) => {
      if (msg.type === "log") {
        addEntry({ id: nextEntryId++, type: "log", level: msg.level, line: msg.line });
      } else if (msg.type === "chat" || msg.type === "actionbar") {
        addEntry({ id: nextEntryId++, type: msg.type, text: msg.text, time: msg.time });
      }
    });
  }, [onMessage, addEntry]);

  // 接続状態変化をシステムメッセージとして表示
  useEffect(() => {
    addEntry({
      id: nextEntryId++,
      type: "sys",
      text: connected ? "接続しました" : "切断されました。再接続中…",
      ok: connected,
    });
  }, [connected, addEntry]);

  // タブ補完タイマーのクリーンアップ
  useEffect(() => {
    return () => {
      if (tabCompleteTimer.current) clearTimeout(tabCompleteTimer.current);
    };
  }, []);

  // 履歴ベースのサジェスト更新
  const updateHistorySuggestions = useCallback(
    (value: string) => {
      if (!value.trim()) {
        setSuggestions([]);
        return;
      }
      const lower = value.toLowerCase();
      const matches = history
        .filter((msg) => msg !== value && msg.toLowerCase().startsWith(lower))
        .slice(0, MAX_HISTORY_SUGGESTIONS);
      setSuggestions(matches);
      setSuggestionMode("history");
    },
    [history],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setInput(val);
      if (tabCompleteTimer.current) clearTimeout(tabCompleteTimer.current);

      if (val.startsWith("/")) {
        setSuggestions([]);
        tabCompleteTimer.current = setTimeout(() => {
          actions.requestTabComplete(val).then((matches) => {
            if (inputRef.current?.value === val) {
              setSuggestions(matches.slice(0, MAX_TAB_SUGGESTIONS));
              setSuggestionMode("tabcomplete");
            }
          });
        }, DEBOUNCE_TAB_COMPLETE_MS);
      } else {
        updateHistorySuggestions(val);
      }
    },
    [actions, updateHistorySuggestions],
  );

  // サジェストをタップして入力欄に反映
  const selectSuggestion = useCallback(
    (suggestion: string) => {
      const newInput =
        suggestionMode === "tabcomplete" ? applyCompletion(input, suggestion) : suggestion;
      setInput(newInput);
      setSuggestions([]);
      inputRef.current?.focus();
    },
    [input, suggestionMode],
  );

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    addToHistory(text);
    actions.sendChat(text);
    setInput("");
    setSuggestions([]);
    inputRef.current?.focus();
  }, [input, actions, addToHistory]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        setSuggestions([]);
        return;
      }
      if (e.key === "Enter" && !e.nativeEvent.isComposing) {
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MainContainer className="donut-main">
        <ChatContainer>
          {/* メッセージ一覧 — autoScrollToBottom で新着時に自動スクロール */}
          <MessageList autoScrollToBottom autoScrollToBottomOnMount scrollBehavior="auto">
            {entries.map((entry) =>
              entry.type === "sys" ? (
                <MessageSeparator
                  key={entry.id}
                  style={{ color: entry.ok ? "var(--color-green)" : "var(--color-yellow)" }}
                >
                  {entry.text}
                </MessageSeparator>
              ) : (
                <MessageRow key={entry.id} entry={entry} />
              ),
            )}
          </MessageList>

          {/* カスタム入力エリア — cs-message-input クラスで ChatContainer 下部に配置 */}
          <div className="cs-message-input donut-input-area">
            {/* タブ補完・履歴サジェスト（タップで選択） */}
            {isOpen && (
              <ul className="donut-suggestions" role="listbox" aria-label="入力候補">
                {suggestions.map((item) => (
                  <li key={item} role="option">
                    <button
                      type="button"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        selectSuggestion(item);
                      }}
                    >
                      {item}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* 入力バー */}
            <div className="donut-input-row">
              <input
                ref={inputRef}
                type="text"
                name="minecraft-command-input"
                inputMode="text"
                aria-label="メッセージを入力"
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="/say こんにちは"
                autoComplete="new-password"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                enterKeyHint="send"
                className="donut-input"
              />
              <button
                type="button"
                onClick={handleSend}
                className="donut-send-btn"
              >
                SEND
              </button>
            </div>
          </div>
        </ChatContainer>
      </MainContainer>
    </div>
  );
}
