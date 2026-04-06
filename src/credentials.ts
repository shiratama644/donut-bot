import fs from "fs";
import path from "path";
import { addOrUpdateAccount } from "./accounts.js";

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
    const password = process.env.BOT_PASSWORD?.trim();
    _credentials = {
      username: process.env.BOT_USERNAME,
      ...(password ? { password } : {}),
    };
    return _credentials;
  }
  try {
    const raw = fs.readFileSync(CREDS_PATH, "utf-8");
    const data = JSON.parse(raw) as Partial<Credentials>;
    if (typeof data.username === "string" && data.username.trim()) {
      _credentials = {
        username: data.username,
        ...(typeof data.password === "string" && data.password.trim() ? { password: data.password } : {}),
      };
      return _credentials;
    }
  } catch {
    // ファイルが存在しないか読めない場合は無視
  }
  return null;
}

/** 認証情報を .cache/credentials.json に保存し、アカウント一覧にも追加する */
export function saveCredentials(creds: Credentials): void {
  _credentials = { ...creds };
  try {
    fs.mkdirSync(path.dirname(CREDS_PATH), { recursive: true });
    fs.writeFileSync(CREDS_PATH, JSON.stringify(creds, null, 2), "utf-8");
  } catch (err) {
    console.warn("[credentials] 認証情報の保存に失敗しました。次回起動時に再入力が必要になる場合があります:", err);
  }
  addOrUpdateAccount(creds);
}

/** 現在の認証情報（メモリ）を返す */
export function getCredentials(): Credentials | null {
  return _credentials;
}

/** 認証情報をメモリと .cache/credentials.json から削除する */
export function clearCredentials(): void {
  _credentials = null;
  try {
    if (fs.existsSync(CREDS_PATH)) {
      fs.unlinkSync(CREDS_PATH);
    }
  } catch (err) {
    console.warn("[credentials] 認証情報の削除に失敗しました:", err);
  }
}
