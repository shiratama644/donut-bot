"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BotMessage } from "@/types/bot";

const RECONNECT_DELAY_MS = 3000;
const TAB_COMPLETE_TIMEOUT_MS = 3000;

export interface BotWebSocketActions {
  sendChat: (text: string) => void;
  requestTabComplete: (text: string) => Promise<string[]>;
}

export interface BotWebSocketState {
  connected: boolean;
  actions: BotWebSocketActions;
  onMessage: (handler: (msg: BotMessage) => void) => () => void;
}

interface TabCompletePending {
  resolve: (matches: string[]) => void;
  timer: ReturnType<typeof setTimeout>;
}

export function useBotWebSocket(url: string): BotWebSocketState {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const handlersRef = useRef<Set<(msg: BotMessage) => void>>(new Set());
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);
  const tabCompletePending = useRef<Map<number, TabCompletePending>>(new Map());
  const tabCompleteRequestId = useRef(0);

  const connect = useCallback(() => {
    if (unmountedRef.current) return;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
    };

    ws.onclose = () => {
      setConnected(false);
      if (!unmountedRef.current) {
        reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS);
      }
    };

    ws.onerror = () => {
      // close イベントで再接続
    };

    ws.onmessage = ({ data }) => {
      try {
        const parsed = JSON.parse(data as string) as Record<string, unknown>;
        // タブ補完レスポンスはUIハンドラーには渡さず内部で処理する
        if (
          parsed.type === "tabcomplete" &&
          typeof parsed.requestId === "number" &&
          Array.isArray(parsed.matches)
        ) {
          const pending = tabCompletePending.current.get(parsed.requestId as number);
          if (pending) {
            clearTimeout(pending.timer);
            tabCompletePending.current.delete(parsed.requestId as number);
            pending.resolve(parsed.matches as string[]);
          }
          return;
        }
        const msg = parsed as unknown as BotMessage;
        handlersRef.current.forEach((h) => h(msg));
      } catch {
        // 無効なJSON無視
      }
    };
  }, [url]);

  useEffect(() => {
    unmountedRef.current = false;
    connect();
    return () => {
      unmountedRef.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      // 未解決のタブ補完リクエストをクリア
      tabCompletePending.current.forEach(({ timer, resolve }) => {
        clearTimeout(timer);
        resolve([]);
      });
      tabCompletePending.current.clear();
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((data: object) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }, []);

  const sendChat = useCallback((text: string) => {
    send({ type: "chat", text });
  }, [send]);

  const requestTabComplete = useCallback((text: string): Promise<string[]> => {
    const ws = wsRef.current;
    if (ws?.readyState !== WebSocket.OPEN) return Promise.resolve([]);

    const requestId = ++tabCompleteRequestId.current;
    return new Promise<string[]>((resolve) => {
      const timer = setTimeout(() => {
        tabCompletePending.current.delete(requestId);
        resolve([]);
      }, TAB_COMPLETE_TIMEOUT_MS);
      tabCompletePending.current.set(requestId, { resolve, timer });
      ws.send(JSON.stringify({ type: "tabcomplete", text, requestId }));
    });
  }, []);

  const onMessage = useCallback((handler: (msg: BotMessage) => void) => {
    handlersRef.current.add(handler);
    return () => { handlersRef.current.delete(handler); };
  }, []);

  return { connected, actions: { sendChat, requestTabComplete }, onMessage };
}
