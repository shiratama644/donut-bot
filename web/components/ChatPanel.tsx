"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { BotWebSocketActions, BotWebSocketState } from "@/hooks/useBotWebSocket";
import { useMessageHistory } from "@/hooks/useMessageHistory";
import { sanitizeText, formatMsgTime } from "@/lib/sanitize";

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
const MAX_ENTRIES = 500;

const LEVEL_STYLE: Record<string, { label: string; colorClass: string }> = {
  info:  { label: "INFO", colorClass: "msg-level--info"  },
  warn:  { label: "WARN", colorClass: "msg-level--warn"  },
  error: { label: "ERR",  colorClass: "msg-level--error" },
  send:  { label: "SEND", colorClass: "msg-level--send"  },
};

let nextEntryId = 0;

type NonSysEntry = Exclude<ChatEntry, { type: "sys" }>;

// ─── 個別メッセージ行 ─────────────────────────────────────
function MessageRow({ entry }: { entry: NonSysEntry }) {
  if (entry.type === "log") {
    const s = LEVEL_STYLE[entry.level] ?? {
      label: entry.level.toUpperCase().slice(0, 4),
      colorClass: "",
    };
    return (
      <div className="msg-row">
        <span className={`msg-level ${s.colorClass}`}>{s.label}</span>
        <span className="msg-log-text">{sanitizeText(entry.line)}</span>
      </div>
    );
  }

  const isChat = entry.type === "chat";
  return (
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
  );
}

// ─── メインコンポーネント ─────────────────────────────────
export default function ChatPanel({ ws, actions }: Props) {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [inputValue, setInputValue] = useState("");
  const inputValueRef = useRef("");
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesBottomRef = useRef<HTMLDivElement>(null);
  const { add: addToHistory } = useMessageHistory();
  const { onMessage, connected } = ws;

  // エントリを追加し上限を超えたら先頭を削除
  const addEntry = useCallback((entry: ChatEntry) => {
    setEntries((prev) => {
      if (prev.length < MAX_ENTRIES) return [...prev, entry];
      return [...prev.slice(prev.length - MAX_ENTRIES + 1), entry];
    });
  }, []);

  // メッセージ追加時に最下部へスクロール
  useEffect(() => {
    messagesBottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, [entries]);

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

  // input の onChange ハンドラ
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    inputValueRef.current = val;
  }, []);

  // 送信処理 — ref から値を読むことでクロージャの古い値を避ける
  const doSend = useCallback(() => {
    const text = inputValueRef.current.trim();
    if (!text) return;
    addToHistory(text);
    actions.sendChat(text);
    inputValueRef.current = "";
    setInputValue("");
    inputRef.current?.focus();
  }, [actions, addToHistory]);

  // Enter キーで送信（IME 確定時は無視）
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.isComposing) {
        e.preventDefault();
        doSend();
      }
    },
    [doSend],
  );

  return (
    <div className="chat-panel">
      {/* メッセージリスト */}
      <div className="chat-messages">
        {entries.map((entry) =>
          entry.type === "sys" ? (
            <div
              key={entry.id}
              className={`msg-separator ${entry.ok ? "msg-separator--ok" : "msg-separator--err"}`}
            >
              <span className="msg-separator-inner">{entry.text}</span>
            </div>
          ) : (
            <div key={entry.id} className="msg-entry">
              <MessageRow entry={entry} />
            </div>
          ),
        )}
        <div ref={messagesBottomRef} />
      </div>

      {/* 入力エリア */}
      <div className="chat-input-area">
        <div className="chat-input-wrapper">
          <input
            ref={inputRef}
            type="text"
            className="chat-input"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="メッセージを入力… (Enter で送信)"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <button
            type="button"
            className="chat-send-btn"
            onClick={doSend}
            aria-label="送信"
          >
            送信 ↑
          </button>
        </div>
      </div>
    </div>
  );
}

