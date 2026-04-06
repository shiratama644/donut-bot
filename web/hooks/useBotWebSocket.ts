"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AuthStatePayload, BotMessage } from "@/types/bot";

const RECONNECT_DELAY_MS = 3000;

export interface BotWebSocketActions {
  sendChat: (text: string) => void;
  sendSetInterval: (ms: number) => void;
  sendDisconnect: () => void;
  sendReconnect: () => void;
  sendSetCredentials: (username: string, password?: string) => void;
  sendLogout: () => void;
  sendSwitchAccount: (username: string) => void;
  sendRemoveAccount: (username: string) => void;
  sendReauthAccount: (username: string) => void;
}

export interface BotWebSocketState {
  connected: boolean;
  botConnected: boolean;
  /** null = サーバーからの応答待ち */
  hasCredentials: boolean | null;
  currentUsername: string | null;
  accounts: { username: string; mcid?: string }[];
  /** 最後にキックされた理由。再接続成功時にリセットされる */
  kickReason: string | null;
  /** Microsoft デバイスコード認証が必要な場合のデータ */
  msaCode: { userCode: string; verificationUri: string } | null;
  /** 認証ライフサイクルの統合状態 */
  authState: AuthStatePayload | null;
  /** Viewer の表示モード */
  viewerMode: "disabled" | "pending" | "prismarine" | "three";
  actions: BotWebSocketActions;
  onMessage: (handler: (msg: BotMessage) => void) => () => void;
}

function isRawWsMessage(value: unknown): value is { type: string } {
  return typeof value === "object" && value !== null && typeof (value as { type?: unknown }).type === "string";
}

export function useBotWebSocket(url: string): BotWebSocketState {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [botConnected, setBotConnected] = useState(false);
  const [hasCredentials, setHasCredentials] = useState<boolean | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<{ username: string; mcid?: string }[]>([]);
  const [kickReason, setKickReason] = useState<string | null>(null);
  const [msaCode, setMsaCode] = useState<{ userCode: string; verificationUri: string } | null>(null);
  const [authState, setAuthState] = useState<AuthStatePayload | null>(null);
  const [viewerMode, setViewerMode] = useState<"disabled" | "pending" | "prismarine" | "three">("pending");
  const authStateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
        const parsed = JSON.parse(data as string) as unknown;
        if (!isRawWsMessage(parsed)) {
          throw new Error("Invalid websocket message shape");
        }
        const msg = parsed as BotMessage;
        if (msg.type === "botConnection") {
          setBotConnected(msg.connected);
          if (msg.connected) {
            setKickReason(null);
          }
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
          setAccounts(msg.accounts);
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
        if (msg.type === "authState") {
          if (msg.version !== 2) {
            throw new Error(`Unsupported authState version: ${String((msg as { version?: unknown }).version)}`);
          }
          if (authStateTimer.current) {
            clearTimeout(authStateTimer.current);
            authStateTimer.current = null;
          }
          if (msg.auth.state === "FAILED") {
            authStateTimer.current = setTimeout(() => {
              setAuthState(msg.auth);
              authStateTimer.current = null;
            }, 150);
          } else {
            setAuthState(msg.auth);
          }
          return;
        }
        if (msg.type === "viewerMode") {
          setViewerMode(msg.mode);
          return;
        }
        if (
          msg.type === "pos" ||
          msg.type === "status" ||
          msg.type === "chat" ||
          msg.type === "actionbar" ||
          msg.type === "log" ||
          msg.type === "sent"
        ) {
          handlersRef.current.forEach((h) => h(msg));
          return;
        }
        throw new Error(`Unknown websocket message type: ${(msg as { type: string }).type}`);
      } catch (err) {
        console.error(err);
      }
    };
  }, [url]);

  useEffect(() => {
    unmountedRef.current = false;
    connect();
    return () => {
      unmountedRef.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (authStateTimer.current) clearTimeout(authStateTimer.current);
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

  const sendSetCredentials = useCallback((username: string, password?: string) => {
    send({
      type: "setCredentials",
      username,
      ...(password ? { password } : {}),
    });
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

  /** MCID 不一致で自動再認証が失敗した際に、手動再認証を開始する。 */
  const sendReauthAccount = useCallback((username: string) => {
    send({ type: "reauthAccount", username });
  }, [send]);

  const onMessage = useCallback((handler: (msg: BotMessage) => void) => {
    handlersRef.current.add(handler);
    return () => { handlersRef.current.delete(handler); };
  }, []);

  const actions = useMemo(
    () => ({ sendChat, sendSetInterval, sendDisconnect, sendReconnect, sendSetCredentials, sendLogout, sendSwitchAccount, sendRemoveAccount, sendReauthAccount }),
    [sendChat, sendSetInterval, sendDisconnect, sendReconnect, sendSetCredentials, sendLogout, sendSwitchAccount, sendRemoveAccount, sendReauthAccount],
  );

  return { connected, botConnected, hasCredentials, currentUsername, accounts, kickReason, msaCode, authState, viewerMode, actions, onMessage };
}
