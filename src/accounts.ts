import fs from "fs";
import path from "path";
import type { Credentials } from "./credentials.js";

export interface AccountEntry {
  username: string;
  /** ログイン後に記録される Minecraft ユーザー名 (MCID) */
  mcid?: string;
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
  if (idx >= 0) {
    // 既存エントリを更新する際は mcid を引き継ぐ
    accounts[idx] = { ...accounts[idx], username: creds.username };
  } else {
    accounts.push({ username: creds.username });
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

/** 保存済みアカウント一覧をそのまま返す */
export function getAccountEntries(): AccountEntry[] {
  return loadAccounts();
}

/** 特定アカウントのエントリを返す */
export function getAccountEntry(username: string): AccountEntry | null {
  return loadAccounts().find((a) => a.username === username) ?? null;
}

/** 保存済みアカウントの認証情報を返す */
export function getAccountCredentials(username: string): Credentials | null {
  const entry = loadAccounts().find((a) => a.username === username);
  return entry ? { username: entry.username } : null;
}

/** ログイン後に MCID を記録する */
export function updateAccountMcid(username: string, mcid: string): void {
  const accounts = loadAccounts();
  const idx = accounts.findIndex((a) => a.username === username);
  if (idx >= 0) {
    accounts[idx] = { ...accounts[idx], mcid };
    saveAccounts(accounts);
  }
}

/**
 * アカウントの Microsoft 認証トークンキャッシュ（profilesFolder）を削除する。
 * PROFILES_FOLDER 環境変数が設定されている場合は共有フォルダのため削除をスキップする。
 */
export function clearAccountProfileCache(username: string): void {
  if (process.env.PROFILES_FOLDER) {
    console.warn(
      `[accounts] PROFILES_FOLDER が設定されているため、キャッシュを自動削除できません。` +
      ` 手動で ${process.env.PROFILES_FOLDER} 内の該当ファイルを削除してください。`,
    );
    return;
  }
  const profileDir = path.join(process.cwd(), ".cache", "profiles", username);
  try {
    if (fs.existsSync(profileDir)) {
      fs.rmSync(profileDir, { recursive: true, force: true });
    }
  } catch (err) {
    console.warn(`[accounts] プロフィールキャッシュの削除に失敗しました:`, err);
  }
}
