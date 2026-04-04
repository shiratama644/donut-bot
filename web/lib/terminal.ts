/**
 * 安全でないエスケープシーケンスを除去（OSC, DCS, PM, APC, SOS, CSI等すべて）
 * 受信データは生テキストであることが期待されるため、エスケープシーケンスはすべて除去する
 */
export function sanitizeForTerminal(text: string): string {
  return text
    // OSC シーケンス: ESC ] ... ST or BEL
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, "")
    // DCS / PM / APC / SOS: ESC [P X ^ _] ... ST
    .replace(/\x1b[P_^X][^\x1b]*\x1b\\/g, "")
    // CSI シーケンス（カラーコード含む全 CSI）: ESC [ ... <final byte>
    .replace(/\x1b\[[\d;]*[\x40-\x7e]/g, "")
    // 残った裸の ESC シーケンス
    .replace(/\x1b[^[\]]/g, "");
}

/** タイムスタンプ文字列 "YYYY-MM-DD HH:MM:SS" の最小文字数 */
const TIMESTAMP_MIN_LENGTH = 19;

/**
 * ISO タイムスタンプ文字列から HH:MM:SS 部分を抽出してサニタイズする
 * `isoTime` は "YYYY-MM-DD HH:MM:SS" 形式（19文字以上）を想定する
 */
export function formatMsgTime(isoTime: string): string {
  if (isoTime.length < TIMESTAMP_MIN_LENGTH) return sanitizeForTerminal(isoTime);
  return sanitizeForTerminal(isoTime.slice(11, 19));
}

/**
 * タブ補完の選択時にカーソル位置にマッチを適用する
 * 入力の最後のスペース以降をマッチで置き換え、先頭の "/" を保持する
 */
export function applyCompletion(currentInput: string, match: string): string {
  const lastSpace = currentInput.lastIndexOf(" ");
  if (lastSpace === -1) {
    // スペースなし: "/gam" → match="gamemode" → "/gamemode"
    const prefix = currentInput.startsWith("/") && !match.startsWith("/") ? "/" : "";
    return prefix + match;
  }
  // スペースあり: "/msg pla" → match="player1" → "/msg player1"
  return currentInput.slice(0, lastSpace + 1) + match;
}
