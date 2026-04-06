# Auth Lifecycle Contract (Source of Truth)

This document defines the authoritative auth lifecycle contract for backend and frontend.
All runtime transitions MUST be executed via `transitionAuthState(...)` in `/home/runner/work/donut-bot/donut-bot/src/authState.ts`.

## States

- `DISCONNECTED`
- `AUTHENTICATING`
- `CONNECTED`
- `REAUTH_REQUIRED`
- `FAILED`

## Allowed transitions

| From | To | Typical trigger | Side effects |
|---|---|---|---|
| `DISCONNECTED` | `AUTHENTICATING` | new connect / manual reauth start | reset retry display fields, broadcast auth update |
| `AUTHENTICATING` | `CONNECTED` | successful spawn lifecycle completion | clear retry metadata, broadcast auth update |
| `AUTHENTICATING` | `REAUTH_REQUIRED` | MCID mismatch with retryable classification | schedule retry, set retry metadata, broadcast |
| `AUTHENTICATING` | `FAILED` | non-retryable auth failure or exhausted retry policy | stop retry, preserve diagnostics, broadcast |
| `AUTHENTICATING` | `DISCONNECTED` | normal disconnect before fully connected | clear in-flight retry flag, broadcast |
| `CONNECTED` | `REAUTH_REQUIRED` | post-login mismatch requiring reauth flow | set retry state and schedule reconnect |
| `CONNECTED` | `DISCONNECTED` | kick/network/manual disconnect | clear in-flight retry flag |
| `REAUTH_REQUIRED` | `AUTHENTICATING` | retry timer fires and reconnect starts | clear `nextRetryAt`, maintain retry session context |
| `REAUTH_REQUIRED` | `FAILED` | retry classification turns permanent | stop retries and keep reason codes |
| `REAUTH_REQUIRED` | `DISCONNECTED` | lifecycle reset/logout while pending | clear retry state |
| `FAILED` | `AUTHENTICATING` | explicit user retry/new lifecycle start | new auth attempt |
| `FAILED` | `DISCONNECTED` | logout/reset | clear session/auth state |

## Rejected transitions

Any transition not in the table above is rejected.
Example: `CONNECTED -> AUTHENTICATING` is rejected unless flow returns through an allowed intermediary (`REAUTH_REQUIRED` or `DISCONNECTED`).
Rejected transitions emit `auth.transition.illegal` logs and do NOT mutate state.

## Observability contract

Each accepted transition emits structured `auth.transition` logs with:

- `from`, `to`
- `context`
- `sessionId`
- `seq` / `prevSeq`
- retry-related fields (`attempt`, `maxAttempts`, `retryInFlight`, `reason`)

`sessionId` is the stable correlation ID for a lifecycle; `seq` gives deterministic ordering.

## Retry classification rules

MCID retry classification reason codes:

- `retryable_mcid_mismatch` (transient)
- `attempt_limit` (permanent)
- `total_duration_limit` (permanent)

Guardrails:

- max attempts enforced
- max total retry duration enforced
- randomized jitter added to backoff
- retry visibility exposed directly on auth state (`attempt`, `nextRetryAt`, `retryStartedAt`, `retryDeadlineAt`, `retryInFlight`)

## Idempotency expectations

- `spawn`: duplicate events must not cause repeated side effects (MCID write/broadcast only once per valid lifecycle).
- `end`: duplicate events must not re-run teardown/reconnect side effects.
- stale session events MUST be ignored if lifecycle/session no longer matches current auth state.

## MCID authoritative write point

MCID persistence source of truth is `spawn`, not `login`, because spawn confirms world-join completion after transient login-phase instability.
MCID writes MUST only occur when session/state validation passes for the active lifecycle.

## Protocol versioning

Auth state websocket payload schema currently uses `version: 2`.

Version mismatch handling:

- backend always emits explicit auth-state version field
- frontend rejects unsupported versions loudly and does not silently degrade
- future version bumps must update this document and the shared type definitions
