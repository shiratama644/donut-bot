export type LogLevel = "info" | "warn" | "error" | "chat" | "send";

export interface PosMessage {
  type: "pos";
  x: number;
  y: number;
  z: number;
}

export interface ChatMessage {
  type: "chat";
  text: string;
  time: string;
}

export interface ActionbarMessage {
  type: "actionbar";
  text: string;
  time: string;
}

export interface LogMessage {
  type: "log";
  level: LogLevel;
  line: string;
}

export interface SentMessage {
  type: "sent";
  text: string;
  time: string;
}

export interface BotStatusMessage {
  type: "status";
  username: string;
  health: number;
  food: number;
  foodSaturation: number;
  gameMode: string;
  experienceLevel: number;
  experiencePoints: number;
  /** 次のレベルへの進捗 (0.0 〜 1.0) */
  experienceProgress: number;
  ping: number;
}

export interface BotConnectionMessage {
  type: "botConnection";
  connected: boolean;
}

export interface KickedMessage {
  type: "kicked";
  /** サーバーから送られたキック理由（人間が読める形式） */
  reason: string;
}

export interface CredentialsInfoMessage {
  type: "credentialsInfo";
  hasCredentials: boolean;
  username: string | null;
}

export interface AccountsListMessage {
  type: "accountsList";
  accounts: { username: string; mcid?: string }[];
}

export interface MsaCodeMessage {
  type: "msaCode";
  userCode: string;
  verificationUri: string;
}

export interface MsaCodeClearedMessage {
  type: "msaCodeCleared";
}

export type AuthStateKind =
  | "DISCONNECTED"
  | "AUTHENTICATING"
  | "CONNECTED"
  | "REAUTH_REQUIRED"
  | "FAILED";

export interface AuthStatePayload {
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

export interface AuthStateMessage {
  type: "authState";
  auth: AuthStatePayload;
}

export type BotMessage = PosMessage | ChatMessage | ActionbarMessage | LogMessage | SentMessage | BotStatusMessage | BotConnectionMessage | KickedMessage | CredentialsInfoMessage | AccountsListMessage | MsaCodeMessage | MsaCodeClearedMessage | AuthStateMessage;

export interface Position {
  x: number;
  y: number;
  z: number;
}
