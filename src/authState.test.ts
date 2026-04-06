import test from "node:test";
import assert from "node:assert/strict";

import { getAllowedAuthTransitions, getAuthState, resetAuthState, transitionAuthState } from "./authState.js";

test("auth transition table is explicit and non-empty", () => {
  const table = getAllowedAuthTransitions();
  assert.ok(table.DISCONNECTED.length > 0);
  assert.ok(table.AUTHENTICATING.length > 0);
  assert.ok(table.CONNECTED.length > 0);
  assert.ok(table.REAUTH_REQUIRED.length > 0);
  assert.ok(table.FAILED.length > 0);
});

test("illegal transition is guarded and does not mutate state", () => {
  resetAuthState("user@example.com");
  const before = transitionAuthState("AUTHENTICATING", {
    username: "user@example.com",
    sessionId: "s-1",
  }, "test.begin");
  const after = transitionAuthState("CONNECTED", {
    username: "user@example.com",
    sessionId: "s-1",
  }, "test.connected");

  assert.equal(after.state, "CONNECTED");
  const illegal = transitionAuthState("AUTHENTICATING", {
    username: "user@example.com",
    sessionId: "s-1",
  }, "test.illegal");
  assert.equal(illegal.state, "CONNECTED");
  assert.equal(illegal.seq, after.seq);
  assert.equal(getAuthState().state, "CONNECTED");
  assert.equal(before.sessionId, "s-1");
});

test("duplicate transition to same state remains idempotent-safe", () => {
  resetAuthState("user@example.com");
  const first = transitionAuthState("AUTHENTICATING", {
    username: "user@example.com",
    sessionId: "s-2",
  }, "test.dup.1");
  const second = transitionAuthState("AUTHENTICATING", {
    username: "user@example.com",
    sessionId: "s-2",
  }, "test.dup.2");
  assert.equal(first.state, "AUTHENTICATING");
  assert.equal(second.state, "AUTHENTICATING");
  assert.ok(second.seq > first.seq);
});
