import { broadcast } from "./broadcast.js";

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
}

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
};

function snapshot(): AuthState {
  return { ...authState };
}

export function getAuthState(): AuthState {
  return snapshot();
}

export function setAuthState(next: Partial<AuthState>): AuthState {
  if (next.state !== undefined) authState.state = next.state;
  if (next.username !== undefined) authState.username = next.username;
  if (next.sessionId !== undefined) authState.sessionId = next.sessionId;
  if (next.attempt !== undefined) authState.attempt = next.attempt;
  if (next.maxAttempts !== undefined) authState.maxAttempts = next.maxAttempts;
  if (next.nextRetryAt !== undefined) authState.nextRetryAt = next.nextRetryAt;
  if (next.reason !== undefined) authState.reason = next.reason;
  if (next.expectedMcid !== undefined) authState.expectedMcid = next.expectedMcid;
  if (next.actualMcid !== undefined) authState.actualMcid = next.actualMcid;
  const current = snapshot();
  broadcast({ type: "authState", auth: current });
  return current;
}

export function resetAuthState(username: string | null = null): AuthState {
  authState.state = "DISCONNECTED";
  authState.username = username;
  authState.sessionId = null;
  authState.attempt = 0;
  authState.maxAttempts = 0;
  authState.nextRetryAt = null;
  authState.reason = null;
  authState.expectedMcid = null;
  authState.actualMcid = null;
  const current = snapshot();
  broadcast({ type: "authState", auth: current });
  return current;
}
