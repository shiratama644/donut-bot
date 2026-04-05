import fs from "fs";
import path from "path";

export interface Credentials {
  username: string;
  password?: string;
}

const CREDS_PATH = path.join(process.cwd(), ".cache", "credentials.json");

let _credentials: Credentials | null = null;

/**
 * 起動時に認証情報をロードする。
 * 優先順位: .env (BOT_USERNAME) > .cache/credentials.json
 */
export function loadCredentials(): Credentials | null {
  if (process.env.BOT_USERNAME) {
    _credentials = {
      username: process.env.BOT_USERNAME,
      password: process.env.BOT_PASSWORD || undefined,
    };
    return _credentials;
  }
  try {
    const raw = fs.readFileSync(CREDS_PATH, "utf-8");
    const data = JSON.parse(raw) as Credentials;
    if (typeof data.username === "string" && data.username.trim()) {
      _credentials = { username: data.username, password: data.password || undefined };
      return _credentials;
    }
  } catch {
    // ファイルが存在しないか読めない場合は無視
  }
  return null;
}

/** 認証情報を .cache/credentials.json に保存し、メモリを更新する */
export function saveCredentials(creds: Credentials): void {
  _credentials = { ...creds };
  try {
    fs.mkdirSync(path.dirname(CREDS_PATH), { recursive: true });
    fs.writeFileSync(CREDS_PATH, JSON.stringify(creds, null, 2), "utf-8");
  } catch {
    // 書き込みエラーは無視
  }
}

/** 現在の認証情報（メモリ）を返す */
export function getCredentials(): Credentials | null {
  return _credentials;
}
