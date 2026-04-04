import { Bot } from "mineflayer";
import { broadcast } from "./broadcast.js";
import { ts } from "./logger.js";

// ─── § カラーコード → ANSI 変換マップ ──────────────────────
const SECTION_TO_ANSI: Record<string, string> = {
  "0": "\x1b[30m",        // Black
  "1": "\x1b[34m",        // Dark Blue
  "2": "\x1b[32m",        // Dark Green
  "3": "\x1b[36m",        // Dark Aqua
  "4": "\x1b[31m",        // Dark Red
  "5": "\x1b[35m",        // Dark Purple
  "6": "\x1b[33m",        // Gold
  "7": "\x1b[37m",        // Gray
  "8": "\x1b[90m",        // Dark Gray
  "9": "\x1b[94m",        // Blue
  "a": "\x1b[92m",        // Green
  "b": "\x1b[96m",        // Aqua
  "c": "\x1b[91m",        // Red
  "d": "\x1b[95m",        // Light Purple
  "e": "\x1b[93m",        // Yellow
  "f": "\x1b[97m",        // White
  "l": "\x1b[1m",         // Bold
  "m": "\x1b[9m",         // Strikethrough
  "n": "\x1b[4m",         // Underline
  "o": "\x1b[3m",         // Italic
  "r": "\x1b[0m",         // Reset
};

/**
 * §カラーコードを含む文字列をANSIエスケープシーケンスに変換する。
 * §k (obfuscated) は § なしの空文字へ変換する。
 */
export function sectionToAnsi(text: string): string {
  return text.replace(/§([0-9a-fk-or])/gi, (_, code: string) => {
    return SECTION_TO_ANSI[code.toLowerCase()] ?? "";
  }) + "\x1b[0m";
}

// ─── チャットメッセージハンドラ ────────────────────────────
export function registerChatHandler(bot: Bot): void {
  bot.on("message", (msg, position) => {
    // アクションバーメッセージ（ホットバー上部のテキスト）は無視
    if (position === "game_info") return;

    process.stdout.write("\n");

    // toMotd() で §カラーコード付きのテキストを取得
    const motd = msg.toMotd();
    // コンソールにはANSIカラーで表示
    const colored = sectionToAnsi(motd);
    console.log(`[CHAT] ${ts()} ${colored}`);

    // NOTE: chat メッセージは { type:"chat", text, time } として独立ブロードキャストし、
    // クライアント側でチャット専用の表示を行う。emit() が送る { type:"log" } とは別扱い。
    broadcast({ type: "chat", text: motd, time: ts() });
  });
}
