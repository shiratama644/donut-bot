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

export interface LogMessage {
  type: "log";
  level: LogLevel;
  line: string;
}

export type BotMessage = PosMessage | ChatMessage | LogMessage;

export interface Position {
  x: number;
  y: number;
  z: number;
}

export const CONTROL_KEYS = ["forward", "back", "left", "right", "jump", "sneak", "sprint"] as const;
export type ControlKey = typeof CONTROL_KEYS[number];
