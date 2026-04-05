"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import type { BotWebSocketActions, BotWebSocketState } from "@/hooks/useBotWebSocket";
import { useMessageHistory } from "@/hooks/useMessageHistory";
import { sanitizeText, formatMsgTime } from "@/lib/sanitize";

/** Minecraft 標準カラーコード (§0–§f) → CSS hex */
const MC_COLOR_HEX: Record<string, string> = {
  "0": "#000000", "1": "#0000AA", "2": "#00AA00", "3": "#00AAAA",
  "4": "#AA0000", "5": "#AA00AA", "6": "#FFAA00", "7": "#AAAAAA",
  "8": "#555555", "9": "#5555FF", "a": "#55FF55", "b": "#55FFFF",
  "c": "#FF5555", "d": "#FF55FF", "e": "#FFFF55", "f": "#FFFFFF",
};

interface McStyle {
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
}

/**
 * Minecraft §コード（§X / §#RRGGBB）をパースして色付き React ノードを返す。
 * ANSI エスケープはあらかじめ sanitizeText() で除去しておくこと。
 */
function renderMinecraftText(raw: string): ReactNode {
  const text = sanitizeText(raw);
  const segments: { text: string; style: McStyle }[] = [];
  let style: McStyle = {};
  let buf = "";
  const re = /§(#[0-9a-f]{6}|[0-9a-fk-or])/gi;
  let last = 0;

  for (const m of text.matchAll(re)) {
    buf += text.slice(last, m.index);
    last = m.index + m[0].length;

    if (buf) { segments.push({ text: buf, style: { ...style } }); buf = ""; }

    const code = m[1].toLowerCase();
    if (code === "r") {
      style = {};
    } else if (code.startsWith("#")) {
      style = { ...style, color: code };
    } else if (MC_COLOR_HEX[code]) {
      style = { ...style, color: MC_COLOR_HEX[code] };
    } else if (code === "l") {
      style = { ...style, bold: true };
    } else if (code === "o") {
      style = { ...style, italic: true };
    } else if (code === "n") {
      style = { ...style, underline: true };
    } else if (code === "m") {
      style = { ...style, strikethrough: true };
    }
    // §k (obfuscated) – スキップ
  }

  buf += text.slice(last);
  if (buf) segments.push({ text: buf, style: { ...style } });

  return segments.map((seg, i) => {
    const css: CSSProperties = {};
    if (seg.style.color)         css.color          = seg.style.color;
    if (seg.style.bold)          css.fontWeight     = "bold";
    if (seg.style.italic)        css.fontStyle      = "italic";
    const deco: string[] = [];
    if (seg.style.underline)     deco.push("underline");
    if (seg.style.strikethrough) deco.push("line-through");
    if (deco.length > 0)         css.textDecoration = deco.join(" ");
    return Object.keys(css).length > 0
      ? <span key={i} style={css}>{seg.text}</span>
      : seg.text;
  });
}

interface Props {
  ws: Pick<BotWebSocketState, "onMessage" | "connected">;
  actions: BotWebSocketActions;
}

// ─── メッセージエントリ型 ─────────────────────────────────
type ChatEntry =
  | { id: number; type: "log"; level: string; line: string }
  | { id: number; type: "chat" | "actionbar" | "sent"; text: string; time?: string }
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
  const isSent = entry.type === "sent";
  return (
    <div className={`msg-chat-row ${isChat ? "msg-chat" : isSent ? "msg-sent" : "msg-actionbar"}`}>
      <div className="msg-header">
        <span className="msg-sender">
          {isChat ? (
            <><span className="material-symbols-outlined msg-icon">chat_bubble</span> Minecraft Chat</>
          ) : isSent ? (
            <><span className="material-symbols-outlined msg-icon">send</span> 送信</>
          ) : (
            <><span className="material-symbols-outlined msg-icon">bolt</span> Action Bar</>
          )}
        </span>
        {entry.time && (
          <span className="msg-time">{formatMsgTime(entry.time)}</span>
        )}
      </div>
      <span className="msg-body">{renderMinecraftText(entry.text)}</span>
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
      } else if (msg.type === "sent") {
        addEntry({ id: nextEntryId++, type: "sent", text: msg.text, time: msg.time });
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
            <div
              key={entry.id}
              className={`msg-entry${
                (entry.type === "log" && entry.level === "send") || entry.type === "sent"
                  ? " msg-entry--sent"
                  : entry.type === "chat"
                  ? " msg-entry--chat"
                  : entry.type === "actionbar"
                  ? " msg-entry--actionbar"
                  : ""
              }`}
            >
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

