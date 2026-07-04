# Plan 001: Fail fast when AUTH_SECRET is missing instead of falling back to a hardcoded secret

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 36636b8..HEAD -- src/lib/session.ts src/lib/playstation.ts src/lib/xbox.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `36636b8`, 2026-07-01
- **Issue**: https://github.com/ludmila-omlopes/filazo/issues/89

## Why this matters

Three security-critical code paths fall back to the hardcoded string `"local-dev-secret-change-me"` when the `AUTH_SECRET` environment variable is unset. If the app is ever deployed without `AUTH_SECRET`, anyone who reads this public repository can forge a session JWT for **any user ID** (full account takeover) and decrypt the PlayStation/Xbox refresh tokens stored in the database. A missing secret must be a hard startup/request failure in production, not a silent downgrade to a publicly known key.

## Current state

filazo is a Next.js 16 App Router app (TypeScript, Prisma/PostgreSQL). Sessions are signed JWTs in an HttpOnly cookie via the `jose` library.

The fallback appears in three files:

- `src/lib/session.ts` — session JWT signing/verification:

```ts
// src/lib/session.ts:7-11
function getSessionSecret() {
  return new TextEncoder().encode(
    process.env.AUTH_SECRET || "local-dev-secret-change-me",
  );
}
```

- `src/lib/playstation.ts:50` — key material for encrypting PSN refresh tokens stored in `ExternalAccount.metadata`:

```ts
const secret = process.env.AUTH_SECRET || "local-dev-secret-change-me";
```

- `src/lib/xbox.ts:145` — same pattern for Xbox token encryption:

```ts
const secret = process.env.AUTH_SECRET || "local-dev-secret-change-me";
```

`AUTH_SECRET` is already documented in `.env.example:3` and `README.md:150` ("should be a long random string in any non-local environment"), so documentation needs no change beyond the note in Step 4.

Repo conventions: plain functions in `src/lib/*.ts` modules, no dependency-injection framework. Errors are thrown as `new Error("...")` with user-actionable messages (see `src/lib/catalog.ts:484` — `throw new Error("Connect a Steam account before syncing your library.")`).

## Commands you will need

| Purpose   | Command             | Expected on success |
|-----------|---------------------|---------------------|
| Install   | `npm install`       | exit 0              |
| Typecheck | `npx tsc --noEmit`  | exit 0, no output   |
| Lint      | `npm run lint`      | exit 0 (3 pre-existing `no-img-element` warnings are OK) |
| Tests     | `npm test`          | exit 0 (runs Node's built-in test runner; there may be zero test files yet — exit 0 either way) |

## Scope

**In scope** (the only files you should modify):
- `src/lib/auth-secret.ts` (create)
- `src/lib/session.ts`
- `src/lib/playstation.ts`
- `src/lib/xbox.ts`
- `src/lib/auth-secret.test.ts` (create)
- `README.md` (one sentence, Step 4)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch, even though they look related):
- `.env.example` — `AUTH_SECRET` is already documented there.
- Any OAuth callback route under `src/app/api/auth/` — they consume these libs; no changes needed.
- The encryption algorithm/format used in `playstation.ts`/`xbox.ts` — only replace how the secret is *obtained*, not how it is used. Changing key derivation would break decryption of already-stored tokens.
- Rotating or invalidating existing sessions.

## Git workflow

- Branch: `advisor/001-enforce-auth-secret` (branched from the current branch or `master`)
- One commit; message style matches repo history (short imperative subject, e.g. "Fail fast when AUTH_SECRET is missing")
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create a single shared accessor

Create `src/lib/auth-secret.ts`:

```ts
const DEV_FALLBACK_SECRET = "local-dev-secret-change-me";

export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (secret && secret.trim().length >= 16) {
    return secret;
  }

  if (process.env.NODE_ENV !== "production") {
    return DEV_FALLBACK_SECRET;
  }

  throw new Error(
    "AUTH_SECRET is not configured. Set a long random AUTH_SECRET environment variable before running filazo in production.",
  );
}
```

Behavior to preserve: local development without `AUTH_SECRET` must keep working (same fallback string, so existing local sessions and locally encrypted tokens remain valid). Only production without a real secret becomes a hard error. The `>= 16` length check also rejects trivially short values in production.

**Verify**: `npx tsc --noEmit` → exit 0

### Step 2: Use it in all three call sites

- In `src/lib/session.ts`, replace the body of `getSessionSecret()`:

```ts
import { getAuthSecret } from "@/lib/auth-secret";

function getSessionSecret() {
  return new TextEncoder().encode(getAuthSecret());
}
```

- In `src/lib/playstation.ts` (line ~50) and `src/lib/xbox.ts` (line ~145), replace
  `const secret = process.env.AUTH_SECRET || "local-dev-secret-change-me";`
  with
  `const secret = getAuthSecret();`
  and add the import. Do not change anything else in how `secret` is used afterwards (key derivation, algorithm, IV handling stay byte-for-byte identical).

**Verify**: `grep -rn "local-dev-secret-change-me" src/` → exactly one match, in `src/lib/auth-secret.ts`

**Verify**: `npx tsc --noEmit` → exit 0

### Step 3: Add unit tests

Create `src/lib/auth-secret.test.ts` using Node's built-in test runner (this repo's `npm test` runs `node --experimental-strip-types --test`; there are no existing test files to model after — this will be among the first):

```ts
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { getAuthSecret } from "./auth-secret.ts";
```

Note on imports: the project uses `@/*` path aliases via tsconfig, but Node's test runner does not resolve them — use the relative `./auth-secret.ts` import (with extension) inside test files.

Cases (save/restore `process.env.AUTH_SECRET` and `process.env.NODE_ENV` around each):
1. Returns the configured value when `AUTH_SECRET` is a long string.
2. Returns the dev fallback when unset and `NODE_ENV` is `"test"`/undefined.
3. Throws when unset and `NODE_ENV` is `"production"`.
4. Throws when set to a short string (e.g. `"abc"`) and `NODE_ENV` is `"production"`.

`NODE_ENV` may be read-only typed in some setups; assign via `process.env.NODE_ENV = "production"` — with type stripping this is plain JS and works.

**Verify**: `npm test` → exit 0, output includes the 4 new passing tests. If `npm test` discovers no test files, run `node --experimental-strip-types --test src/lib/auth-secret.test.ts` and report the discovery issue in your notes.

### Step 4: One-line README note

In `README.md`, in the section around line 150 where `AUTH_SECRET` is described, extend the sentence to state the new behavior, e.g.: "`AUTH_SECRET` should be a long random string in any non-local environment. The app refuses to start sessions in production without it."

**Verify**: `npm run lint` → exit 0

## Test plan

Covered by Step 3 (4 unit tests on `getAuthSecret`). No integration tests: the three call sites are one-line substitutions whose behavior is proven by the accessor's tests plus typecheck.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm test` exits 0 with the 4 new tests passing
- [ ] `grep -rn "local-dev-secret-change-me" src/` → only `src/lib/auth-secret.ts`
- [ ] `grep -rn "process.env.AUTH_SECRET" src/` → only `src/lib/auth-secret.ts`
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The excerpts in "Current state" don't match the live code (drift).
- `src/lib/playstation.ts` or `src/lib/xbox.ts` uses the secret in a way that would change ciphertext compatibility if the *value* changes (it shouldn't — you are not changing the value in dev, and production previously running on the fallback is exactly the misconfiguration this plan makes loud).
- You find additional `process.env.AUTH_SECRET` fallback sites beyond the three listed — report them; do not silently expand scope.
- `npm test` cannot run TypeScript test files at all (report the exact error).

## Maintenance notes

- Any future code needing `AUTH_SECRET` must import `getAuthSecret()` — never read the env var directly. A reviewer should reject new `process.env.AUTH_SECRET` reads.
- Deliberately deferred: rotating the secret / re-encrypting stored provider tokens, and startup-time (vs first-use) validation. First use is acceptable because every session read hits `getSessionSecret()`.
- If a deployment was ever run in production without `AUTH_SECRET`, sessions and stored PSN/Xbox tokens from that period were protected by a public string; the operator should set a real secret and ask users to reconnect provider accounts.
