import { broadcast } from "./broadcast.js";
import { log } from "./logger.js";

export type AuthStateKind =
  | "DISCONNECTED"
  | "AUTHENTICATING"
  | "CONNECTED"
  | "REAUTH_REQUIRED"
  | "FAILED";

export interface AuthState {
  state: AuthStateKind;
  username: string | null;
  sessionId: string | null;
  attempt: number;
  maxAttempts: number;
  nextRetryAt: number | null;
  reason: string | null;
  expectedMcid: string | null;
  actualMcid: string | null;
  retryStartedAt: number | null;
  retryDeadlineAt: number | null;
  retryInFlight: boolean;
  seq: number;
  protocolVersion: 2;
}

type TransitionMap = Record<AuthStateKind, readonly AuthStateKind[]>;

const ALLOWED_TRANSITIONS: TransitionMap = {
  DISCONNECTED: ["AUTHENTICATING"],
  AUTHENTICATING: ["CONNECTED", "REAUTH_REQUIRED", "FAILED", "DISCONNECTED"],
  CONNECTED: ["DISCONNECTED", "REAUTH_REQUIRED"],
  REAUTH_REQUIRED: ["AUTHENTICATING", "FAILED", "DISCONNECTED"],
  FAILED: ["AUTHENTICATING", "DISCONNECTED"],
};

const authState: AuthState = {
  state: "DISCONNECTED",
  username: null,
  sessionId: null,
  attempt: 0,
  maxAttempts: 0,
  nextRetryAt: null,
  reason: null,
  expectedMcid: null,
  actualMcid: null,
  retryStartedAt: null,
  retryDeadlineAt: null,
  retryInFlight: false,
  seq: 0,
  protocolVersion: 2,
};

function snapshot(): AuthState {
  return { ...authState };
}

function publish(current: AuthState): void {
  broadcast({ type: "authState", auth: current, version: current.protocolVersion });
}

function applyPatch(next: Partial<AuthState>): void {
  if (next.state !== undefined) authState.state = next.state;
  if (next.username !== undefined) authState.username = next.username;
  if (next.sessionId !== undefined) authState.sessionId = next.sessionId;
  if (next.attempt !== undefined) authState.attempt = next.attempt;
  if (next.maxAttempts !== undefined) authState.maxAttempts = next.maxAttempts;
  if (next.nextRetryAt !== undefined) authState.nextRetryAt = next.nextRetryAt;
  if (next.reason !== undefined) authState.reason = next.reason;
  if (next.expectedMcid !== undefined) authState.expectedMcid = next.expectedMcid;
  if (next.actualMcid !== undefined) authState.actualMcid = next.actualMcid;
  if (next.retryStartedAt !== undefined) authState.retryStartedAt = next.retryStartedAt;
  if (next.retryDeadlineAt !== undefined) authState.retryDeadlineAt = next.retryDeadlineAt;
  if (next.retryInFlight !== undefined) authState.retryInFlight = next.retryInFlight;
}

function isAllowedTransition(prev: AuthStateKind, next: AuthStateKind): boolean {
  return prev === next || ALLOWED_TRANSITIONS[prev].includes(next);
}

export function getAuthState(): AuthState {
  return snapshot();
}

export function getAllowedAuthTransitions(): TransitionMap {
  return ALLOWED_TRANSITIONS;
}

export function transitionAuthState(nextState: AuthStateKind, patch: Partial<AuthState>, context: string): AuthState {
  const prev = snapshot();
  if (!isAllowedTransition(prev.state, nextState)) {
    log.event("error", "auth.transition.illegal", {
      context,
      sessionId: patch.sessionId ?? prev.sessionId,
      username: patch.username ?? prev.username,
      from: prev.state,
      to: nextState,
      seq: prev.seq,
    });
    return prev;
  }
  authState.seq = prev.seq + 1;
  authState.state = nextState;
  applyPatch(patch);
  authState.protocolVersion = 2;
  const current = snapshot();
  publish(current);
  log.event("info", "auth.transition", {
    context,
    sessionId: current.sessionId,
    username: current.username,
    from: prev.state,
    to: current.state,
    prevSeq: prev.seq,
    seq: current.seq,
    attempt: current.attempt,
    maxAttempts: current.maxAttempts,
    retryInFlight: current.retryInFlight,
    reason: current.reason,
  });
  return current;
}

export function resetAuthState(username: string | null = null): AuthState {
  const prev = snapshot();
  authState.seq = prev.seq + 1;
  authState.state = "DISCONNECTED";
  authState.username = username;
  authState.sessionId = null;
  authState.attempt = 0;
  authState.maxAttempts = 0;
  authState.nextRetryAt = null;
  authState.reason = null;
  authState.expectedMcid = null;
  authState.actualMcid = null;
  authState.retryStartedAt = null;
  authState.retryDeadlineAt = null;
  authState.retryInFlight = false;
  authState.protocolVersion = 2;
  const current = snapshot();
  publish(current);
  log.event("info", "auth.transition", {
    context: "reset",
    from: prev.state,
    to: current.state,
    prevSeq: prev.seq,
    seq: current.seq,
    username: current.username,
  });
  return current;
}
