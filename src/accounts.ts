import fs from "fs";
import path from "path";
import type { Credentials } from "./credentials.js";

export interface AccountEntry {
  username: string;
}

const ACCOUNTS_PATH = path.join(process.cwd(), ".cache", "accounts.json");

/** 保存済みアカウント一覧をファイルから読み込む */
export function loadAccounts(): AccountEntry[] {
  try {
    const raw = fs.readFileSync(ACCOUNTS_PATH, "utf-8");
    const data = JSON.parse(raw) as unknown;
    if (Array.isArray(data)) {
      return (data as AccountEntry[]).filter(
        (a) => typeof a.username === "string" && a.username.trim(),
      );
    }
  } catch {
    // ファイルが存在しないか読めない場合は無視
  }
  return [];
}

/** 保存済みアカウント一覧をファイルに書き込む */
export function saveAccounts(accounts: AccountEntry[]): void {
  try {
    fs.mkdirSync(path.dirname(ACCOUNTS_PATH), { recursive: true });
    fs.writeFileSync(ACCOUNTS_PATH, JSON.stringify(accounts, null, 2), "utf-8");
  } catch (err) {
    console.warn("[accounts] アカウント一覧の保存に失敗しました:", err);
  }
}

/** アカウントを追加または更新する */
export function addOrUpdateAccount(creds: Credentials): void {
  const accounts = loadAccounts();
  const idx = accounts.findIndex((a) => a.username === creds.username);
  const entry: AccountEntry = { username: creds.username };
  if (idx >= 0) {
    accounts[idx] = entry;
  } else {
    accounts.push(entry);
  }
  saveAccounts(accounts);
}

/** アカウントを一覧から削除する */
export function removeAccount(username: string): void {
  const accounts = loadAccounts().filter((a) => a.username !== username);
  saveAccounts(accounts);
}

/** 保存済みアカウントのユーザー名一覧を返す */
export function getAccountUsernames(): string[] {
  return loadAccounts().map((a) => a.username);
}

/** 保存済みアカウントの認証情報を返す */
export function getAccountCredentials(username: string): Credentials | null {
  const entry = loadAccounts().find((a) => a.username === username);
  return entry ? { username: entry.username } : null;
}
