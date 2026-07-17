# Plan 018: Stop Steam sync from overwriting the user's chosen display name and avatar

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6fa54f4..HEAD -- src/lib/catalog.ts src/lib/steam.ts`
> This plan was written against branch `feat/feedback-admin-reorg` at commit
> `6fa54f4` **plus uncommitted changes** to `src/lib/steam.ts` and
> `src/lib/catalog.ts` (a `steam-library.ts` extraction and rawData-merge
> work). If the excerpts under "Current state" do not match your checkout,
> treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `6fa54f4`, 2026-07-17
- **Issue**: https://github.com/ludmila-omlopes/filazo/issues/139

## Why this matters

Every Steam library sync — including the daily scheduled one — unconditionally
overwrites `User.displayName` and `User.avatarUrl` with the Steam persona name
and avatar. A user who signed up with Google as "Ludmila" and set her own
avatar gets silently renamed to her Steam handle every night. The PlayStation
and Xbox connect flows already do this correctly (they only fill the fields
when they are empty); Steam is the outlier, in two places. After this plan,
provider syncs never replace user profile fields the user already has — they
only fill gaps.

## Current state

- `src/lib/catalog.ts` — canonical catalog + sync executors. The Steam sync
  path (`syncSteamLibraryForAccount`) contains the first overwrite.
- `src/lib/steam.ts` — Steam OpenID + Web API integration. The connect flow
  (`upsertSteamAccountForUser`) contains the second overwrite.

Overwrite #1 — `src/lib/catalog.ts:631-637` (inside `syncSteamLibraryForAccount`,
runs on every manual and scheduled sync):

```ts
  await prisma.user.update({
    where: { id: userId },
    data: {
      displayName: profile.displayName ?? undefined,
      avatarUrl: profile.avatarUrl ?? undefined,
    },
  });
```

Overwrite #2 — `src/lib/steam.ts:278-293` (inside `upsertSteamAccountForUser`,
runs when connecting/re-connecting Steam):

```ts
export async function upsertSteamAccountForUser({
  userId,
  steamId,
}: {
  userId: string;
  steamId: string;
}) {
  const profile = await steamAdapter.fetchProfile(steamId);

  await prisma.user.update({
    where: { id: userId },
    data: {
      displayName: profile.displayName ?? undefined,
      avatarUrl: profile.avatarUrl ?? undefined,
    },
  });
```

The convention to match — PlayStation connect flow,
`src/lib/playstation.ts:703-709` (Xbox does the same at
`src/lib/xbox.ts:706-712`):

```ts
  await prisma.user.update({
    where: { id: userId },
    data: {
      displayName: existingUser.displayName ?? profile.displayName ?? undefined,
      avatarUrl: existingUser.avatarUrl ?? profile.avatarUrl ?? undefined,
    },
  });
```

Note the pattern: `existingUser.<field> ?? profile.<field> ?? undefined` —
keep what the user has, fill from the provider only when empty.
`prisma.user.update` with `undefined` for a field means "leave unchanged".

Repo test conventions: pure helpers live in small modules under `src/lib/`
with a colocated `<module>.test.ts` using `node:test` + `node:assert/strict`.
Exemplar: `src/lib/synced-playtime.test.ts` (tests
`src/lib/playtime-conflict.ts`). Test files import the module under test with
a **relative path including the `.ts` extension** (the node test runner cannot
resolve the `@/` alias), so the module under test must not import anything via
`@/...`.

## Commands you will need

| Purpose   | Command             | Expected on success        |
|-----------|---------------------|----------------------------|
| Install   | `npm install`       | exit 0                     |
| Lint      | `npm run lint`      | exit 0                     |
| Typecheck | `npm run typecheck` | exit 0, no errors          |
| Tests     | `npm test`          | all pass, none failing     |

## Scope

**In scope** (the only files you should modify/create):
- `src/lib/user-profile-sync.ts` (create)
- `src/lib/user-profile-sync.test.ts` (create)
- `src/lib/catalog.ts` (only the `prisma.user.update` block inside `syncSteamLibraryForAccount`)
- `src/lib/steam.ts` (only the `prisma.user.update` block inside `upsertSteamAccountForUser`)

**Out of scope** (do NOT touch, even though they look related):
- The `prisma.externalAccount.update`/`upsert` calls next to these blocks —
  the *provider account* record SHOULD reflect the latest Steam persona.
- `src/lib/playstation.ts` and `src/lib/xbox.ts` — they already behave
  correctly; migrating them onto the new helper is a possible follow-up, not
  this plan.
- Any schema change.

## Git workflow

- Branch: `advisor/018-fix-steam-sync-profile-clobber` (branched from the
  current working branch).
- Commit message style: short imperative sentence, e.g.
  `Stop Steam sync from overwriting user profile fields` (matches repo history
  like "Fix playtime sync consistency").
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create the pure helper

Create `src/lib/user-profile-sync.ts` with exactly this content (no imports —
it must stay loadable by the node test runner):

```ts
type UserProfileFields = {
  displayName: string | null;
  avatarUrl: string | null;
};

type ProviderProfileFields = {
  displayName?: string | null;
  avatarUrl?: string | null;
};

// Provider syncs must never replace profile fields the user already has;
// they only fill gaps. `undefined` tells Prisma to leave the column as is.
export function getUserProfileSyncData(
  existing: UserProfileFields | null,
  profile: ProviderProfileFields,
) {
  return {
    displayName: existing?.displayName ?? profile.displayName ?? undefined,
    avatarUrl: existing?.avatarUrl ?? profile.avatarUrl ?? undefined,
  };
}
```

**Verify**: `npm run typecheck` → exit 0.

### Step 2: Test the helper

Create `src/lib/user-profile-sync.test.ts` modeled after
`src/lib/synced-playtime.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { getUserProfileSyncData } from "./user-profile-sync.ts";

test("keeps the user's existing display name and avatar", () => {
  assert.deepEqual(
    getUserProfileSyncData(
      { displayName: "Ludmila", avatarUrl: "https://example.com/me.png" },
      { displayName: "xX_steam_Xx", avatarUrl: "https://steam/avatar.png" },
    ),
    { displayName: "Ludmila", avatarUrl: "https://example.com/me.png" },
  );
});

test("fills missing fields from the provider profile", () => {
  assert.deepEqual(
    getUserProfileSyncData(
      { displayName: null, avatarUrl: null },
      { displayName: "xX_steam_Xx", avatarUrl: "https://steam/avatar.png" },
    ),
    { displayName: "xX_steam_Xx", avatarUrl: "https://steam/avatar.png" },
  );
});

test("leaves fields untouched when neither side has a value", () => {
  assert.deepEqual(
    getUserProfileSyncData({ displayName: null, avatarUrl: null }, {}),
    { displayName: undefined, avatarUrl: undefined },
  );
});

test("handles a missing user row", () => {
  assert.deepEqual(getUserProfileSyncData(null, { displayName: "Steam" }), {
    displayName: "Steam",
    avatarUrl: undefined,
  });
});
```

**Verify**: `npm test` → all pass, including the 4 new tests.

### Step 3: Fix the sync path in catalog.ts

In `src/lib/catalog.ts`, inside `syncSteamLibraryForAccount`, replace the
`prisma.user.update` block (excerpt in "Current state") with a lookup + the
helper:

```ts
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true, avatarUrl: true },
  });
  await prisma.user.update({
    where: { id: userId },
    data: getUserProfileSyncData(existingUser, profile),
  });
```

Add the import `import { getUserProfileSyncData } from "@/lib/user-profile-sync";`
alongside the existing `@/lib/...` imports (app code uses the alias; only
test-loaded modules avoid it).

**Verify**: `npm run typecheck` → exit 0.

### Step 4: Fix the connect path in steam.ts

In `src/lib/steam.ts`, inside `upsertSteamAccountForUser`, apply the same
change:

```ts
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true, avatarUrl: true },
  });
  await prisma.user.update({
    where: { id: userId },
    data: getUserProfileSyncData(existingUser, profile),
  });
```

Add the same import.

**Verify**: `npm run lint` → exit 0; `npm run typecheck` → exit 0.

## Test plan

- The 4 unit tests from Step 2 (happy path, fill-gap path, no-data path,
  missing-user path) in `src/lib/user-profile-sync.test.ts`.
- Verification: `npm test` → all pass.

## Done criteria

ALL must hold:

- [ ] `npm run lint` exits 0
- [ ] `npm run typecheck` exits 0
- [ ] `npm test` exits 0 and includes the 4 new `user-profile-sync` tests
- [ ] `grep -n "displayName: profile.displayName" src/lib/catalog.ts src/lib/steam.ts` returns no matches
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The excerpts in "Current state" don't match the live code (drift — see the
  drift check at the top; the working tree this was planned against included
  uncommitted changes).
- `syncSteamLibraryForAccount` or `upsertSteamAccountForUser` no longer
  contains a `prisma.user.update` call (someone may have fixed this already).
- Fixing this appears to require touching `playstation.ts`, `xbox.ts`, or the
  `externalAccount` updates.

## Maintenance notes

- If a "profile settings" edit form is added later, nothing changes here — the
  invariant is "sync never replaces user-set fields".
- Follow-up (deferred): migrate the inline `existingUser.x ?? profile.x`
  patterns in `playstation.ts:703-709` and `xbox.ts:706-712` onto
  `getUserProfileSyncData` for consistency.
- Reviewer should scrutinize: that the `externalAccount` update right below
  the changed block in `catalog.ts` still updates the *account* record
  unconditionally (that behavior is correct and must not have been altered).
