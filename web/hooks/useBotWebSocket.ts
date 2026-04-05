"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BotMessage } from "@/types/bot";

const RECONNECT_DELAY_MS = 3000;

export interface BotWebSocketActions {
  sendChat: (text: string) => void;
  sendSetInterval: (ms: number) => void;
  sendDisconnect: () => void;
  sendReconnect: () => void;
}

export interface BotWebSocketState {
  connected: boolean;
  botConnected: boolean;
  actions: BotWebSocketActions;
  onMessage: (handler: (msg: BotMessage) => void) => () => void;
}

export function useBotWebSocket(url: string): BotWebSocketState {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [botConnected, setBotConnected] = useState(false);
  const handlersRef = useRef<Set<(msg: BotMessage) => void>>(new Set());
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

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
        const msg = JSON.parse(data as string) as unknown as BotMessage;
        if (msg.type === "botConnection") {
          setBotConnected(msg.connected);
          return;
        }
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

  const sendSetInterval = useCallback((ms: number) => {
    send({ type: "setStatusInterval", ms });
  }, [send]);

  const sendDisconnect = useCallback(() => {
    send({ type: "disconnect" });
  }, [send]);

  const sendReconnect = useCallback(() => {
    send({ type: "reconnect" });
  }, [send]);

  const onMessage = useCallback((handler: (msg: BotMessage) => void) => {
    handlersRef.current.add(handler);
    return () => { handlersRef.current.delete(handler); };
  }, []);

  const actions = useMemo(
    () => ({ sendChat, sendSetInterval, sendDisconnect, sendReconnect }),
    [sendChat, sendSetInterval, sendDisconnect, sendReconnect],
  );

  return { connected, botConnected, actions, onMessage };
}

