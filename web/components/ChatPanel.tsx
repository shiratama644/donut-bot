"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MainContainer,
  ChatContainer,
  MessageList,
  Message,
  MessageSeparator,
  MessageInput,
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
const DEBOUNCE_TAB_COMPLETE_MS = 250;
const MAX_HISTORY_SUGGESTIONS = 8;
const MAX_TAB_SUGGESTIONS = 10;
const MAX_ENTRIES = 500;

const LEVEL_STYLE: Record<string, { label: string; colorClass: string }> = {
  info:  { label: "INFO", colorClass: "msg-level--info"  },
  warn:  { label: "WARN", colorClass: "msg-level--warn"  },
  error: { label: "ERR",  colorClass: "msg-level--error" },
  send:  { label: "SEND", colorClass: "msg-level--send"  },
};

let nextEntryId = 0;

type NonSysEntry = Exclude<ChatEntry, { type: "sys" }>;
type SuggestionMode = "history" | "tabcomplete";

// ─── 個別メッセージ行 ─────────────────────────────────────
function MessageRow({ entry }: { entry: NonSysEntry }) {
  if (entry.type === "log") {
    const s = LEVEL_STYLE[entry.level] ?? {
      label: entry.level.toUpperCase().slice(0, 4),
      colorClass: "",
    };
    return (
      <Message
        model={{ direction: "incoming", position: "single", type: "custom" }}
        avatarSpacer={false}
      >
        <Message.CustomContent>
          <div className="msg-row">
            <span className={`msg-level ${s.colorClass}`}>{s.label}</span>
            <span className="msg-log-text">{sanitizeText(entry.line)}</span>
          </div>
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
        <div className={`msg-chat-row ${isChat ? "msg-chat" : "msg-actionbar"}`}>
          <div className="msg-header">
            <span className="msg-sender">
              {isChat ? "💬 Minecraft Chat" : "🎯 Action Bar"}
            </span>
            {entry.time && (
              <span className="msg-time">{formatMsgTime(entry.time)}</span>
            )}
          </div>
          <span className="msg-body">{sanitizeText(entry.text)}</span>
        </div>
      </Message.CustomContent>
    </Message>
  );
}

// ─── メインコンポーネント ─────────────────────────────────
export default function ChatPanel({ ws, actions }: Props) {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [inputKey, setInputKey] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const inputTextRef = useRef("");
  const { history, add: addToHistory } = useMessageHistory();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionMode, setSuggestionMode] = useState<SuggestionMode>("history");
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

  // MessageInput の onChange ハンドラ
  const handleInputChange = useCallback(
    (
      _innerHtml: string,
      _textContent: string,
      innerText: string,
    ) => {
      const val = innerText;
      inputTextRef.current = val;
      if (tabCompleteTimer.current) clearTimeout(tabCompleteTimer.current);

      if (val.startsWith("/")) {
        setSuggestions([]);
        tabCompleteTimer.current = setTimeout(() => {
          actions.requestTabComplete(val).then((matches) => {
            if (inputTextRef.current === val) {
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

  // MessageInput の onSend ハンドラ（Enter キーまたは送信ボタン）
  const handleSend = useCallback(
    (
      _innerHtml: string,
      textContent: string,
      innerText: string,
    ) => {
      const text = (innerText || textContent || inputTextRef.current).trim();
      if (!text) return;
      addToHistory(text);
      actions.sendChat(text);
      inputTextRef.current = "";
      setInputValue("");
      setInputKey((k) => k + 1);
      setSuggestions([]);
    },
    [actions, addToHistory],
  );

  // サジェストを選択して入力欄に反映
  const selectSuggestion = useCallback(
    (suggestion: string) => {
      const newInput =
        suggestionMode === "tabcomplete"
          ? applyCompletion(inputTextRef.current, suggestion)
          : suggestion;
      inputTextRef.current = newInput;
      setInputValue(newInput);
      setInputKey((k) => k + 1);
      setSuggestions([]);
    },
    [suggestionMode],
  );

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        position: "relative",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <MainContainer style={{ flex: 1, minHeight: 0 }}>
        <ChatContainer>
          <MessageList autoScrollToBottom autoScrollToBottomOnMount scrollBehavior="auto">
            {entries.map((entry) =>
              entry.type === "sys" ? (
                <MessageSeparator
                  key={entry.id}
                  style={{ color: entry.ok ? "var(--c-green)" : "var(--c-yellow)" }}
                >
                  {entry.text}
                </MessageSeparator>
              ) : (
                <MessageRow key={entry.id} entry={entry} />
              ),
            )}
          </MessageList>

          <MessageInput
            key={inputKey}
            value={inputValue}
            placeholder="メッセージを入力… (/ でコマンド補完、Enter で送信)"
            attachButton={false}
            sendButton={true}
            onSend={handleSend}
            onChange={handleInputChange}
          />
        </ChatContainer>
      </MainContainer>

      {/* タブ補完・履歴サジェスト */}
      {suggestions.length > 0 && (
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
    </div>
  );
}
