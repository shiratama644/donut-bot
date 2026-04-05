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

export type BotMessage = PosMessage | ChatMessage | ActionbarMessage | LogMessage | SentMessage;

export interface Position {
  x: number;
  y: number;
  z: number;
}
