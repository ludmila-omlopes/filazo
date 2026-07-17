# Plan 020: Bind the Steam connect/login flow to the initiating browser with a state cookie

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6fa54f4..HEAD -- src/lib/steam.ts src/app/api/auth/steam/route.ts src/app/api/auth/steam/callback/route.ts`
> This plan was written against branch `feat/feedback-admin-reorg` at commit
> `6fa54f4` **plus uncommitted changes** to `src/lib/steam.ts` (a
> `steam-library.ts` extraction). If the excerpts under "Current state" do
> not match your checkout, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (touches a login flow; a mistake locks users out of Steam connect)
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `6fa54f4`, 2026-07-17
- **Issue**: https://github.com/ludmila-omlopes/filazo/issues/141

## Why this matters

The Steam OpenID flow has no binding between the browser that *started* the
flow and the browser that *finishes* it. Attack: an attacker authenticates
with their own Steam account, intercepts the redirect back to
`/api/auth/steam/callback?...` before their browser follows it, and sends
that URL to a victim who is signed in to filazo. The victim's visit passes
OpenID verification (the assertion is genuine, just not initiated by the
victim), and the callback links the **attacker's** Steam ID to the
**victim's** user. Because Steam is also a login method, the attacker can
later "Sign in with Steam" and land in the victim's session — account
takeover via one click on a link.

The repo already solved this exact problem for Xbox with a per-browser state
cookie (`src/app/api/auth/xbox/route.ts` + its callback). This plan applies
the identical pattern to Steam. OpenID 2.0 carries no `state` parameter, but
the standard equivalent is a nonce query parameter on `openid.return_to`,
which the provider echoes back and covers with its signature.

## Current state

- `src/app/api/auth/steam/route.ts` — flow entry; currently just redirects
  (9 lines, shown in full):

```ts
import { NextResponse } from "next/server";
import { createSteamAuthUrl } from "@/lib/steam";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = process.env.APP_URL || requestUrl.origin;

  return NextResponse.redirect(createSteamAuthUrl(origin));
}
```

- `src/lib/steam.ts:69-87` — `createSteamAuthUrl(origin)` builds the OpenID
  request; the relevant line sets
  `openid.return_to` to `` `${origin}/api/auth/steam/callback` ``.
- `src/lib/steam.ts:89-122` — `verifySteamOpenIdCallback(searchParams)` posts
  the assertion to Steam's `check_authentication` endpoint and extracts the
  Steam ID. (This verification itself is adequate — do not change it.)
- `src/app/api/auth/steam/callback/route.ts` — verifies, then links/logs in
  with **no state check** (lines 7–43). Note the dual behavior that must be
  preserved: with a session it links Steam to that user; without a session it
  logs in an existing Steam-linked user.

The pattern to copy — `src/app/api/auth/xbox/route.ts` (entry):

```ts
const XBOX_OAUTH_STATE_COOKIE = "filazo-xbox-oauth-state";
...
    const state = crypto.randomBytes(16).toString("hex");
    const cookieStore = await cookies();

    cookieStore.set(XBOX_OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 10,
    });

    return NextResponse.redirect(createXboxAuthUrl(origin, state));
```

and `src/app/api/auth/xbox/callback/route.ts` (validation):

```ts
    const state = url.searchParams.get("state");
    const cookieStore = await cookies();
    const expectedState = cookieStore.get(XBOX_OAUTH_STATE_COOKIE)?.value;
    cookieStore.delete(XBOX_OAUTH_STATE_COOKIE);
    ...
    if (!state || !expectedState || state !== expectedState) {
      throw new Error("Xbox sign-in state could not be verified.");
    }
```

Test conventions: the node test runner (`npm test`) cannot resolve the `@/`
import alias, so unit-testable code must live in a module with no aliased
imports and be imported in tests by relative path with the `.ts` extension.
Exemplar test: `src/lib/steam-library.test.ts` / `src/lib/auth-secret.test.ts`.

## Commands you will need

| Purpose   | Command             | Expected on success |
|-----------|---------------------|---------------------|
| Install   | `npm install`       | exit 0              |
| Lint      | `npm run lint`      | exit 0              |
| Typecheck | `npm run typecheck` | exit 0, no errors   |
| Tests     | `npm test`          | all pass            |

## Scope

**In scope** (the only files you should modify/create):
- `src/lib/steam-openid.ts` (create — pure OpenID URL/verification helpers)
- `src/lib/steam-openid.test.ts` (create)
- `src/lib/steam.ts` (remove the moved functions, re-export or update imports)
- `src/app/api/auth/steam/route.ts`
- `src/app/api/auth/steam/callback/route.ts`

**Out of scope** (do NOT touch):
- The Xbox and PlayStation flows.
- `verifySteamOpenIdCallback`'s verification logic (the POST to
  `check_authentication` and Steam-ID extraction stay byte-identical —
  it only moves files).
- Session code (`src/lib/session.ts`), registration gating, and the
  translator usage in the callback.

## Git workflow

- Branch: `advisor/020-steam-connect-state-binding`.
- Commit message style: short imperative sentence, e.g.
  `Bind Steam connect flow to the browser with a state cookie`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Extract pure OpenID helpers into `src/lib/steam-openid.ts`

Create `src/lib/steam-openid.ts`. Move — without behavior change — from
`src/lib/steam.ts`:

- the `STEAM_OPENID_ENDPOINT` constant,
- `createSteamAuthUrl`, extended with an optional `state`:

```ts
export function createSteamAuthUrl(origin: string, state?: string) {
  const returnTo = new URL(`${origin}/api/auth/steam/callback`);
  if (state) {
    returnTo.searchParams.set("state", state);
  }

  const url = new URL(STEAM_OPENID_ENDPOINT);
  url.searchParams.set("openid.ns", "http://specs.openid.net/auth/2.0");
  url.searchParams.set("openid.mode", "checkid_setup");
  url.searchParams.set("openid.return_to", returnTo.toString());
  url.searchParams.set("openid.realm", origin);
  url.searchParams.set(
    "openid.identity",
    "http://specs.openid.net/auth/2.0/identifier_select",
  );
  url.searchParams.set(
    "openid.claimed_id",
    "http://specs.openid.net/auth/2.0/identifier_select",
  );
  return url.toString();
}
```

- `verifySteamOpenIdCallback` — copied byte-identical.

This module must have **no imports** from `@/...` (it needs none — only
`fetch` and `URL`/`URLSearchParams`, which are globals).

In `src/lib/steam.ts`: delete the moved code and add
`import { createSteamAuthUrl, verifySteamOpenIdCallback } from "@/lib/steam-openid";`
plus `export { createSteamAuthUrl, verifySteamOpenIdCallback };` so existing
importers keep working. (Check importers with
`grep -rn "createSteamAuthUrl\|verifySteamOpenIdCallback" src/` and leave
their import paths working either way.)

**Verify**: `npm run typecheck` → exit 0.

### Step 2: Unit-test the URL builder

Create `src/lib/steam-openid.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { createSteamAuthUrl } from "./steam-openid.ts";

test("builds a checkid_setup request against Steam's endpoint", () => {
  const url = new URL(createSteamAuthUrl("https://app.example"));
  assert.equal(url.origin, "https://steamcommunity.com");
  assert.equal(url.searchParams.get("openid.mode"), "checkid_setup");
  assert.equal(url.searchParams.get("openid.realm"), "https://app.example");
  assert.equal(
    url.searchParams.get("openid.return_to"),
    "https://app.example/api/auth/steam/callback",
  );
});

test("threads the state nonce through return_to", () => {
  const url = new URL(createSteamAuthUrl("https://app.example", "abc123"));
  const returnTo = new URL(url.searchParams.get("openid.return_to")!);
  assert.equal(returnTo.pathname, "/api/auth/steam/callback");
  assert.equal(returnTo.searchParams.get("state"), "abc123");
});
```

**Verify**: `npm test` → all pass including the 2 new tests.

### Step 3: Set the state cookie in the entry route

Rewrite `src/app/api/auth/steam/route.ts` following the Xbox entry route
pattern (excerpt in "Current state") with:

- cookie name constant: `const STEAM_OPENID_STATE_COOKIE = "filazo-steam-oauth-state";`
- `crypto.randomBytes(16).toString("hex")` state, same cookie attributes as
  Xbox (`httpOnly`, `sameSite: "lax"`, `secure` in production, `path: "/"`,
  `maxAge: 60 * 10`),
- redirect to `createSteamAuthUrl(origin, state)`,
- keep the `process.env.APP_URL || requestUrl.origin` origin resolution,
- wrap in try/catch redirecting to
  `/profile?error=...` like the Xbox entry route does.

Export the cookie name from this file or duplicate the string literal in the
callback exactly (Xbox duplicates the literal in both routes — match that).

**Verify**: `npm run typecheck` → exit 0.

### Step 4: Validate state in the callback

In `src/app/api/auth/steam/callback/route.ts`, inside the existing `try`
block, **before** calling `verifySteamOpenIdCallback`:

```ts
    const state = url.searchParams.get("state");
    const cookieStore = await cookies();
    const expectedState = cookieStore.get(STEAM_OPENID_STATE_COOKIE)?.value;
    cookieStore.delete(STEAM_OPENID_STATE_COOKIE);

    if (!state || !expectedState || state !== expectedState) {
      throw new Error("Steam sign-in state could not be verified.");
    }
```

Add `import { cookies } from "next/headers";` and the cookie-name constant.
Everything after the check (verification, account lookup, linking, session)
stays untouched.

**Verify**: `npm run lint` → exit 0; `npm run typecheck` → exit 0;
`npm test` → all pass.

### Step 5: Manual smoke test (only if Steam credentials are available)

If the operator's environment has a browser and a Steam account: visit
`/api/auth/steam`, complete Steam login, and confirm the callback lands on
`/profile?tab=integrations&connected=steam`. If you cannot run this, state so
explicitly in your report — Steam's echo of `return_to` query parameters is
standard OpenID behavior but this plan's only runtime proof is a real
round-trip.

## Test plan

- The 2 unit tests from Step 2 (endpoint/params shape; state threading) in
  `src/lib/steam-openid.test.ts`, modeled after `src/lib/steam-library.test.ts`.
- Verification: `npm test` → all pass.

## Done criteria

ALL must hold:

- [ ] `npm run lint` exits 0
- [ ] `npm run typecheck` exits 0
- [ ] `npm test` exits 0 and includes the 2 new `steam-openid` tests
- [ ] `grep -n "filazo-steam-oauth-state" src/app/api/auth/steam/route.ts src/app/api/auth/steam/callback/route.ts` matches in both files
- [ ] `grep -n "state could not be verified" src/app/api/auth/steam/callback/route.ts` matches
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The callback route no longer matches the "Current state" description
  (e.g. someone already added state handling).
- Preserving the dual login/link behavior seems to require changing
  `src/lib/session.ts` or the registration gating
  (`auth.error.steamRegistrationClosed` branch) — those are out of scope.
- The manual smoke test (if run) shows Steam dropping the `state` query
  parameter from `return_to` — that invalidates the design; report instead
  of switching to a different mechanism.

## Maintenance notes

- The state cookie makes the Steam *flow* browser-bound. A remaining, lesser
  gap (deferred): a signed-in user who completes the flow re-links silently;
  a confirmation screen for "this Steam account is already linked to another
  filazo user" would further harden linking, but requires product/UX input.
- Reviewer should scrutinize: the cookie is deleted before the comparison
  branches (single-use nonce), and `verifySteamOpenIdCallback` moved without
  any diff in its body.
- The old plans/README rejection note "Steam OpenID verification weakness —
  adequate" refers to assertion verification, which is indeed fine; this plan
  addresses flow binding, a different property. Both notes stand.
