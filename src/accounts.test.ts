import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";

import { addOrUpdateAccount, getAccountEntry, updateAccountMcid } from "./accounts.js";

function withTempCwd<T>(run: () => T): T {
  const prev = process.cwd();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "donut-bot-accounts-test-"));
  process.chdir(tempDir);
  try {
    return run();
  } finally {
    process.chdir(prev);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

test("addOrUpdateAccount preserves existing mcid when account already exists", () => {
  withTempCwd(() => {
    addOrUpdateAccount({ username: "user@example.com" });
    updateAccountMcid("user@example.com", "StoredMcid");

    addOrUpdateAccount({ username: "user@example.com" });
    const entry = getAccountEntry("user@example.com");
    assert.equal(entry?.mcid, "StoredMcid");
  });
});

test("addOrUpdateAccount does not clobber other account mcid entries", () => {
  withTempCwd(() => {
    addOrUpdateAccount({ username: "a@example.com" });
    addOrUpdateAccount({ username: "b@example.com" });
    updateAccountMcid("a@example.com", "McidA");
    updateAccountMcid("b@example.com", "McidB");

    addOrUpdateAccount({ username: "a@example.com" });
    assert.equal(getAccountEntry("a@example.com")?.mcid, "McidA");
    assert.equal(getAccountEntry("b@example.com")?.mcid, "McidB");
  });
});
