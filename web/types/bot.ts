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
  ping: number;
}

export type BotMessage = PosMessage | ChatMessage | ActionbarMessage | LogMessage | SentMessage | BotStatusMessage;

export interface Position {
  x: number;
  y: number;
  z: number;
}
