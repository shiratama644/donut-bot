import { broadcast } from "./broadcast.js";

// ─── 時刻 ────────────────────────────────────────────────
export function ts(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

// ─── ログ ────────────────────────────────────────────────
export type LogLevel = "info" | "warn" | "error" | "send";

export const log = {
  info:  (msg: string) => emit("info",  `[INFO]  ${ts()} ${msg}`),
  warn:  (msg: string) => emit("warn",  `[WARN]  ${ts()} ${msg}`),
  error: (msg: string, err?: unknown) => {
    emit("error", `[ERROR] ${ts()} ${msg}`);
    if (err instanceof Error) {
      emit("error", `        message : ${err.message}`);
      emit("error", `        stack   : ${err.stack ?? "(no stack)"}`);
    } else if (err !== undefined) {
      emit("error", `        detail  : ${JSON.stringify(err)}`);
    }
  },
};

export function emit(level: LogLevel, line: string): void {
  switch (level) {
    case "warn":  console.warn(line);  break;
    case "error": console.error(line); break;
    default:      console.log(line);   break;
  }
  if (level !== "send") {
    broadcast({ type: "log", level, line });
  }
}
