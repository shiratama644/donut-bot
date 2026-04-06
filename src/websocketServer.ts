import http from "http";
import { randomUUID } from "crypto";
import { WebSocketServer, WebSocket } from "ws";
import { Bot } from "mineflayer";
import { WEB_PORT } from "./config.js";
import { log, emit, ts } from "./logger.js";
import { broadcast, setWss } from "./broadcast.js";
import { setStatusIntervalMs } from "./status.js";
import { saveCredentials, getCredentials, clearCredentials } from "./credentials.js";
import { getAccountEntries, getAccountCredentials, removeAccount, clearAccountProfileCache } from "./accounts.js";
import { getAuthState, resetAuthState, transitionAuthState } from "./authState.js";

// ─── モジュールレベルの状態 ───────────────────────────────
let botRef: Bot | null = null;
let serverStarted = false;
let isBotConnected = false;
let isConnecting = false;
let reconnectCallback: (() => void) | null = null;

const MAX_MCID_REAUTH_ATTEMPTS = 3;
const MCID_REAUTH_BASE_BACKOFF_MS = 1000;
const MCID_REAUTH_MAX_BACKOFF_MS = 10000;
const MCID_REAUTH_MAX_TOTAL_DURATION_MS = 60_000;

interface McidRetryState {
  username: string | null;
  sessionId: string | null;
  attempts: number;
  timer: ReturnType<typeof setTimeout> | null;
}

const mcidRetryState: McidRetryState = {
  username: null,
  sessionId: null,
  attempts: 0,
  timer: null,
};

export function setReconnectCallback(fn: () => void): void {
  reconnectCallback = fn;
}

/** createBot() の先頭で呼び出す — 二重接続を防ぐ */
export function setBotConnecting(): void {
  isConnecting = true;
}

/**
 * bot の end イベントで呼び出す。
 * botRef が渡された bot と同一の場合のみクリアし、
 * 常に isConnecting をリセットする。
 */
export function clearBotRef(bot: Bot): void {
  if (botRef === bot) {
    botRef = null;
  }
  isConnecting = false;
}

export function setBotConnected(connected: boolean): void {
  isBotConnected = connected;
  if (connected) {
    isConnecting = false;
  }
  broadcast({ type: "botConnection", connected });
}

/** MCID 不一致などの内部的な切断後に再接続を要求する */
export function requestReconnect(): void {
  if (!isConnecting && !isBotConnected) {
    reconnectCallback?.();
  }
}

/**
 * 認証ライフサイクルを新規開始する。
 */
export function beginAuthLifecycle(username: string, sessionId: string): void {
  if (mcidRetryState.timer) {
    clearTimeout(mcidRetryState.timer);
    mcidRetryState.timer = null;
  }
  mcidRetryState.username = username;
  mcidRetryState.sessionId = sessionId;
  mcidRetryState.attempts = 0;
  transitionAuthState("AUTHENTICATING", {
    username,
    sessionId,
    attempt: 0,
    maxAttempts: MAX_MCID_REAUTH_ATTEMPTS,
    nextRetryAt: null,
    reason: null,
    expectedMcid: null,
    actualMcid: null,
    retryStartedAt: null,
    retryDeadlineAt: null,
    retryInFlight: false,
  }, "beginAuthLifecycle");
  log.event("info", "auth.lifecycle.begin", { username, sessionId });
}

export function markAuthConnected(username: string, sessionId: string): void {
  if (mcidRetryState.timer) {
    clearTimeout(mcidRetryState.timer);
    mcidRetryState.timer = null;
  }
  mcidRetryState.username = username;
  mcidRetryState.sessionId = sessionId;
  mcidRetryState.attempts = 0;
  transitionAuthState("CONNECTED", {
    username,
    sessionId,
    attempt: 0,
    maxAttempts: MAX_MCID_REAUTH_ATTEMPTS,
    nextRetryAt: null,
    reason: null,
    expectedMcid: null,
    actualMcid: null,
    retryStartedAt: null,
    retryDeadlineAt: null,
    retryInFlight: false,
  }, "markAuthConnected");
  log.event("info", "auth.lifecycle.connected", { username, sessionId });
}

type RetryClassification = {
  classification: "transient" | "permanent";
  reason: "attempt_limit" | "total_duration_limit" | "retryable_mcid_mismatch";
};

function classifyMcidFailure(attempt: number, startedAt: number, now: number): RetryClassification {
  if (attempt > MAX_MCID_REAUTH_ATTEMPTS) {
    return { classification: "permanent", reason: "attempt_limit" };
  }
  if (now - startedAt > MCID_REAUTH_MAX_TOTAL_DURATION_MS) {
    return { classification: "permanent", reason: "total_duration_limit" };
  }
  return { classification: "transient", reason: "retryable_mcid_mismatch" };
}

function computeBackoffWithJitterMs(attempt: number): number {
  const exponential = Math.min(
    MCID_REAUTH_MAX_BACKOFF_MS,
    MCID_REAUTH_BASE_BACKOFF_MS * (2 ** Math.max(0, attempt - 1)),
  );
  const jitter = Math.floor(Math.random() * 500);
  return exponential + jitter;
}

/**
 * MCID 不一致による自動再認証を要求する。
 */
export function requestMcidReauth(username: string, details: { expected: string; actual: string; sessionId: string }): void {
  if (mcidRetryState.timer) {
    clearTimeout(mcidRetryState.timer);
    mcidRetryState.timer = null;
  }
  const now = Date.now();
  const current = getAuthState();
  const retryStartedAt = current.retryStartedAt ?? now;
  const retryDeadlineAt = retryStartedAt + MCID_REAUTH_MAX_TOTAL_DURATION_MS;
  const attempt = mcidRetryState.attempts + 1;
  const retry = classifyMcidFailure(attempt, retryStartedAt, now);
  if (retry.classification === "permanent") {
    mcidRetryState.attempts = attempt;
    transitionAuthState("FAILED", {
      username,
      sessionId: details.sessionId,
      attempt,
      maxAttempts: MAX_MCID_REAUTH_ATTEMPTS,
      nextRetryAt: null,
      reason: "mcid_mismatch_retry_exhausted",
      expectedMcid: details.expected,
      actualMcid: details.actual,
      retryStartedAt,
      retryDeadlineAt,
      retryInFlight: false,
    }, "requestMcidReauth.permanent");
    log.event("error", "auth.reauth.exhausted", {
      username,
      sessionId: details.sessionId,
      attempt,
      maxAttempts: MAX_MCID_REAUTH_ATTEMPTS,
      classification: retry.classification,
      classificationReason: retry.reason,
      expectedMcid: details.expected,
      actualMcid: details.actual,
      recoverable: false,
      retryStartedAt,
      retryDeadlineAt,
    });
    return;
  }

  const delayMs = computeBackoffWithJitterMs(attempt);
  const nextRetryAt = Date.now() + delayMs;
  mcidRetryState.username = username;
  mcidRetryState.sessionId = details.sessionId;
  mcidRetryState.attempts = attempt;
  transitionAuthState("REAUTH_REQUIRED", {
    username,
    sessionId: details.sessionId,
    attempt,
    maxAttempts: MAX_MCID_REAUTH_ATTEMPTS,
    nextRetryAt,
    reason: "mcid_mismatch",
    expectedMcid: details.expected,
    actualMcid: details.actual,
    retryStartedAt,
    retryDeadlineAt,
    retryInFlight: true,
  }, "requestMcidReauth.transient");
  log.event("warn", "auth.reauth.scheduled", {
    username,
    sessionId: details.sessionId,
    attempt,
    maxAttempts: MAX_MCID_REAUTH_ATTEMPTS,
    classification: retry.classification,
    classificationReason: retry.reason,
    recoverable: true,
    expectedMcid: details.expected,
    actualMcid: details.actual,
    delayMs,
    nextRetryAt,
    retryStartedAt,
    retryDeadlineAt,
  });
  mcidRetryState.timer = setTimeout(() => {
    mcidRetryState.timer = null;
    const state = getAuthState();
    if (!isConnecting && !isBotConnected && state.sessionId === details.sessionId) {
      transitionAuthState("AUTHENTICATING", {
        username,
        sessionId: details.sessionId,
        attempt,
        maxAttempts: MAX_MCID_REAUTH_ATTEMPTS,
        nextRetryAt: null,
        reason: "mcid_mismatch_retry",
        retryStartedAt,
        retryDeadlineAt,
        retryInFlight: false,
      }, "requestMcidReauth.timer");
      reconnectCallback?.();
    }
  }, delayMs);
}

export function markAuthDisconnected(reason: string, username: string | null): void {
  const current = getAuthState();
  if (current.state === "FAILED" || current.state === "REAUTH_REQUIRED") {
    return;
  }
  transitionAuthState("DISCONNECTED", {
    username,
    sessionId: current.sessionId,
    nextRetryAt: null,
    reason,
    retryInFlight: false,
  }, "markAuthDisconnected");
  log.event("warn", "auth.lifecycle.disconnected", {
    username,
    sessionId: current.sessionId,
    reason,
  });
}

// ─── WebSocket サーバー初期化（Bot なしで起動可能）────────
export function initWebSocketServer(): void {
  if (serverStarted) return;
  serverStarted = true;

  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("DonutSMP Bot WebSocket Server\n");
  });

  const wss = new WebSocketServer({ server });
  setWss(wss);

  wss.on("connection", (ws) => {
    log.info("Web クライアント接続");

    // 接続時に現在のBot接続状態を送る
    ws.send(JSON.stringify({ type: "botConnection", connected: isBotConnected }));

    // 接続時に認証情報の有無を送る（パスワードは送らない）
    const creds = getCredentials();
    ws.send(JSON.stringify({
      type: "credentialsInfo",
      hasCredentials: creds !== null,
      username: creds?.username ?? null,
    }));

    // 接続時に保存済みアカウント一覧を送る（ユーザー名と MCID）
    ws.send(JSON.stringify({
      type: "accountsList",
      accounts: getAccountEntries(),
    }));
    ws.send(JSON.stringify({
      type: "authState",
      auth: getAuthState(),
      version: 2,
    }));

    // 接続時に現在の座標を送る
    const pos = botRef?.entity?.position;
    if (pos && !isNaN(pos.x)) {
      ws.send(JSON.stringify({ type: "pos", x: pos.x, y: pos.y, z: pos.z }));
    }

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as unknown;
        if (typeof msg !== "object" || msg === null || typeof (msg as { type?: unknown }).type !== "string") {
          log.event("error", "ws.message.invalid_shape", { raw: raw.toString().slice(0, 256) });
          return;
        }
        handleClientMessage(ws, msg as Record<string, unknown>);
      } catch {
        log.event("error", "ws.message.invalid_json");
      }
    });

    ws.on("close", () => log.info("Web クライアント切断"));
  });

  server.listen(WEB_PORT, () => {
    log.info(`WebSocket サーバー起動: ws://localhost:${WEB_PORT}`);
  });
}

// ─── Bot 接続時に botRef を更新（サーバーは再起動しない）──
export function startWebSocketServer(bot: Bot): void {
  botRef = bot;
  // initWebSocketServer() が先に呼ばれていることを前提とするが、
  // 呼ばれていない場合のフォールバックとしても機能する
  initWebSocketServer();
}

function handleClientMessage(ws: WebSocket, msg: Record<string, unknown>): void {
  if (msg.type === "chat" && typeof msg.text === "string" && msg.text.trim()) {
    if (!botRef) return;
    const text = msg.text.trim();
    botRef.chat(text);
    emit("send", `[SEND/WEB] ${text}`);
    broadcast({ type: "sent", text, time: ts() });
    return;
  }

  if (msg.type === "setStatusInterval" && typeof msg.ms === "number") {
    setStatusIntervalMs(msg.ms);
    return;
  }

  if (msg.type === "disconnect") {
    if (botRef && isBotConnected) {
      botRef.end("disconnected by user");
    }
    return;
  }

  if (msg.type === "reconnect") {
    if (!isBotConnected && !isConnecting) {
      reconnectCallback?.();
    }
    return;
  }

  if (msg.type === "setCredentials") {
    const username = typeof msg.username === "string" ? msg.username.trim() : "";
    if (!username) return;

    saveCredentials({ username });
    log.info(`認証情報を更新しました — ユーザー名: ${username}`);

    // 全クライアントに更新を通知
    broadcast({ type: "credentialsInfo", hasCredentials: true, username });
    broadcast({ type: "accountsList", accounts: getAccountEntries() });

    if (isBotConnected && botRef) {
      // 現在接続中 → 切断して再接続
      const currentBot = botRef;
      currentBot.once("end", () => {
        reconnectCallback?.();
      });
      currentBot.end("credentials updated");
    } else if (!isConnecting) {
      // 未接続かつ接続中でない → そのまま接続
      reconnectCallback?.();
    }
    return;
  }

  if (msg.type === "switchAccount") {
    const username = typeof msg.username === "string" ? msg.username.trim() : "";
    if (!username) return;

    const savedCreds = getAccountCredentials(username);
    if (!savedCreds) {
      log.warn(`switchAccount: アカウントが見つかりません — ${username}`);
      return;
    }

    saveCredentials(savedCreds);
    log.info(`アカウントを切り替えました — ユーザー名: ${username}`);

    broadcast({ type: "credentialsInfo", hasCredentials: true, username });

    if (isBotConnected && botRef) {
      const currentBot = botRef;
      currentBot.once("end", () => {
        reconnectCallback?.();
      });
      currentBot.end("account switched");
    } else if (!isConnecting) {
      reconnectCallback?.();
    }
    return;
  }

  if (msg.type === "removeAccount") {
    const username = typeof msg.username === "string" ? msg.username.trim() : "";
    if (!username) return;

    removeAccount(username);
    // アカウント削除時にトークンキャッシュも削除し、再登録時に正しい認証を強制する
    clearAccountProfileCache(username);
    log.info(`アカウントを削除しました — ユーザー名: ${username}`);

    broadcast({ type: "accountsList", accounts: getAccountEntries() });

    // 削除対象がアクティブアカウントの場合はログアウト
    const creds = getCredentials();
    if (creds?.username === username) {
      clearCredentials();
      broadcast({ type: "credentialsInfo", hasCredentials: false, username: null });
      if (isBotConnected && botRef) {
        botRef.end("account removed");
      }
    }
    return;
  }

  if (msg.type === "reauthAccount") {
    const username = typeof msg.username === "string" ? msg.username.trim() : "";
    if (!username) return;

    const savedCreds = getAccountCredentials(username);
    if (!savedCreds) {
      log.warn(`reauthAccount: アカウントが見つかりません — ${username}`);
      return;
    }

    // トークンキャッシュを削除して MSA 再認証を強制する
    clearAccountProfileCache(username);
    log.info(`再認証のためトークンキャッシュをクリアしました — ユーザー名: ${username}`);
    const current = getAuthState();
    beginAuthLifecycle(username, current.sessionId ?? randomUUID());
    log.event("info", "auth.reauth.manual", { username, sessionId: getAuthState().sessionId });

    saveCredentials(savedCreds);
    broadcast({ type: "credentialsInfo", hasCredentials: true, username });

    if (isBotConnected && botRef) {
      const currentBot = botRef;
      currentBot.once("end", () => {
        reconnectCallback?.();
      });
      currentBot.end("reauthenticating");
    } else if (!isConnecting) {
      reconnectCallback?.();
    }
    return;
  }

  if (msg.type === "logout") {
    // 認証情報を削除
    clearCredentials();
    log.info("ログアウトしました");

    // 全クライアントに認証情報なしを通知
    broadcast({ type: "credentialsInfo", hasCredentials: false, username: null });

    // Botが接続中なら切断
    if (isBotConnected && botRef) {
      botRef.end("logged out");
    } else {
      resetAuthState(null);
    }
    return;
  }

  if (
    msg.type === "tabcomplete" &&
    typeof msg.text === "string" &&
    typeof msg.requestId === "number"
  ) {
    if (!botRef) return;
    const { text, requestId } = msg as { text: string; requestId: number };
    botRef.tabComplete(text)
      .then((matches) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "tabcomplete", requestId, matches: matches.map((m) => m.match) }));
        }
      })
      .catch(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "tabcomplete", requestId, matches: [] }));
        }
      });
    return;
  }

  log.event("error", "ws.message.unknown_type", { type: msg.type });
}
