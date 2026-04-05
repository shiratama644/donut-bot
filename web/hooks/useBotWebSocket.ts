"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BotMessage } from "@/types/bot";

const RECONNECT_DELAY_MS = 3000;

export interface BotWebSocketActions {
  sendChat: (text: string) => void;
  sendSetInterval: (ms: number) => void;
  sendDisconnect: () => void;
  sendReconnect: () => void;
  sendSetCredentials: (username: string) => void;
  sendLogout: () => void;
  sendSwitchAccount: (username: string) => void;
  sendRemoveAccount: (username: string) => void;
}

export interface BotWebSocketState {
  connected: boolean;
  botConnected: boolean;
  /** null = サーバーからの応答待ち */
  hasCredentials: boolean | null;
  currentUsername: string | null;
  accounts: string[];
  /** 最後にキックされた理由。再接続成功時にリセットされる */
  kickReason: string | null;
  /** Microsoft デバイスコード認証が必要な場合のデータ */
  msaCode: { userCode: string; verificationUri: string } | null;
  actions: BotWebSocketActions;
  onMessage: (handler: (msg: BotMessage) => void) => () => void;
}

export function useBotWebSocket(url: string): BotWebSocketState {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [botConnected, setBotConnected] = useState(false);
  const [hasCredentials, setHasCredentials] = useState<boolean | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [kickReason, setKickReason] = useState<string | null>(null);
  const [msaCode, setMsaCode] = useState<{ userCode: string; verificationUri: string } | null>(null);
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
      setHasCredentials(null);
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
          if (msg.connected) setKickReason(null);
          return;
        }
        if (msg.type === "kicked") {
          setKickReason(msg.reason);
          return;
        }
        if (msg.type === "credentialsInfo") {
          setHasCredentials(msg.hasCredentials);
          setCurrentUsername(msg.username);
          return;
        }
        if (msg.type === "accountsList") {
          setAccounts(msg.usernames);
          return;
        }
        if (msg.type === "msaCode") {
          setMsaCode({ userCode: msg.userCode, verificationUri: msg.verificationUri });
          return;
        }
        if (msg.type === "msaCodeCleared") {
          setMsaCode(null);
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

  const sendSetCredentials = useCallback((username: string) => {
    send({ type: "setCredentials", username });
  }, [send]);

  const sendLogout = useCallback(() => {
    send({ type: "logout" });
  }, [send]);

  const sendSwitchAccount = useCallback((username: string) => {
    send({ type: "switchAccount", username });
  }, [send]);

  const sendRemoveAccount = useCallback((username: string) => {
    send({ type: "removeAccount", username });
  }, [send]);

  const onMessage = useCallback((handler: (msg: BotMessage) => void) => {
    handlersRef.current.add(handler);
    return () => { handlersRef.current.delete(handler); };
  }, []);

  const actions = useMemo(
    () => ({ sendChat, sendSetInterval, sendDisconnect, sendReconnect, sendSetCredentials, sendLogout, sendSwitchAccount, sendRemoveAccount }),
    [sendChat, sendSetInterval, sendDisconnect, sendReconnect, sendSetCredentials, sendLogout, sendSwitchAccount, sendRemoveAccount],
  );

  return { connected, botConnected, hasCredentials, currentUsername, accounts, kickReason, msaCode, actions, onMessage };
}

