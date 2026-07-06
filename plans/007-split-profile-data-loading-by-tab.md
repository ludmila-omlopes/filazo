# Plan 007: Split Profile Data Loading By Tab

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan in
> `plans/README.md` unless a reviewer told you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 80086a6..HEAD -- src/lib/catalog.ts src/app/profile src/lib/profile-games.ts tests`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `80086a6`, 2026-07-03
- **Issue**: https://github.com/ludmila-omlopes/filazo/issues/99

## Why this matters

`/profile` currently loads the user's entire game library and entire journal
history before it knows which tab will render. This makes the calm overview,
integrations, and setup tabs pay the cost of the Games and Journal tabs. Large
libraries will make profile rendering slower and heavier, and the current shape
also makes future pagination harder.

## Current state

- `src/lib/catalog.ts` exports `getProfileData(userId)`, which loads all
  external accounts, all game entries with full game records, all journal
  entries with media and duplicate game includes, and the latest import jobs.
- `src/app/profile/page.tsx` calls `getProfileData(userId)` before branching on
  `activeTab`.
- Profile components receive one broad `profile` object and often read
  `profile.user.gameEntries`.

Current unbounded include:

```ts
// src/lib/catalog.ts:1076-1102
export async function getProfileData(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      externalAccounts: { orderBy: { createdAt: "asc" } },
      gameEntries: {
        include: { game: true },
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      },
      journalEntries: {
        include: {
          game: true,
          media: true,
          userGameEntry: { include: { game: true } },
        },
        orderBy: { occurredAt: "desc" },
      },
      importJobs: { ... },
    },
  });
```

Current page order:

```ts
// src/app/profile/page.tsx:69-83
let profile: Awaited<ReturnType<typeof getProfileData>>;
try {
  profile = await getProfileData(userId);
}
...
const query = await searchParams;
const activeTab = parseActiveTab(query.tab);
```

Repo conventions to match:

- App Router server components by default; keep data loading on the server.
- Mutations remain server actions.
- Keep source syncing, CSV import, and manual add flows in the Sources tab.
- Avoid prominent backlog-like totals in overview surfaces.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Lint | `npm run lint` | exit 0; existing `next/image` warnings may remain |
| Typecheck | `npm run typecheck` | exit 0, no TypeScript errors |
| Tests | `npm test` | exit 0, all tests pass |

## Scope

**In scope**:

- `src/lib/catalog.ts`
- `src/app/profile/page.tsx`
- `src/app/profile/_components/profile-types.ts`
- Profile tab components that need narrowed props
- Existing profile-related tests under `tests/`

**Out of scope**:

- Redesigning the profile UI
- Changing import/sync behavior
- Changing `Game`, `GameProviderLink`, or `UserGameEntry` schema
- Adding client-side fetching for profile tabs
- Paginating the Games tab UI; this plan prepares for that but does not have to
  ship pagination

## Git workflow

- Branch: `codex/007-split-profile-data-loading`
- Commit message style: imperative, matching recent history such as
  `Redesign catalog: status by row color + label`
- Do not push or open a PR unless the operator instructed it.

## Steps

### Step 1: Parse the active tab before loading profile data

In `src/app/profile/page.tsx`, await `searchParams` and compute `activeTab`,
`setupStep`, filters, and related query state before calling profile data
loaders. Keep the signed-out, expired-session, and beta-access redirects
unchanged.

**Verify**: `npm run typecheck` -> exit 0.

### Step 2: Split the broad profile query into base and tab-specific data

In `src/lib/catalog.ts`, replace the single unbounded `getProfileData(userId)`
implementation with a small base query plus tab-specific helpers. One
acceptable shape:

```ts
export async function getProfileData(userId: string, options: {
  activeTab: ProfileTabLike;
  activeJournalEntryId?: string | null;
  includeDormant?: boolean;
})
```

The exact type can live in `catalog.ts` to avoid import cycles, but the behavior
must be:

- Always load the user, external accounts, latest import preview, current
  playing entries, playing-next entries, and enough favorite/shelf entries for
  overview panels.
- Only load the full `gameEntries` collection for `activeTab === "games"` and
  for tabs whose component truly needs full choices.
- Only load full `journalEntries` with media for `activeTab === "journal"`.
- Preserve current return fields (`ownedEntries`, `shelfEntries`,
  `wishlistEntries`, `favoriteEntries`, `currentPlayingEntries`,
  `playingNextEntries`, `latestImport`, provider accounts) or update
  `ProfileData` and call sites consistently.

Do not return `null` differently; missing user should still produce `null`.

**Verify**: `rg -n "journalEntries:|gameEntries:" src/lib/catalog.ts` -> the
full unbounded includes are not in the always-loaded base query.

### Step 3: Update profile components to accept narrowed data

Update `ProfileRail`, `GreetingStrip`, `CurrentPlayingPanel`,
`PlayingNextPanel`, `IntegrationsPanel`, `JournalTab`, and `ShelfGrid` only as
needed for the new profile shape.

Rules:

- Components on overview/integrations/setup must not require full
  `profile.user.gameEntries` or full `profile.user.journalEntries`.
- `ShelfGrid` may still receive all entries when the Games tab is active.
- `JournalTab` may still receive enough game choices and selected/recent
  journal entries when the Journal tab is active.

**Verify**:
`rg -n "profile\\.user\\.gameEntries|profile\\.user\\.journalEntries" src/app/profile/_components src/app/profile/page.tsx`
-> remaining matches are only in components rendered for tabs where that full
data is intentionally loaded, or they have been replaced by narrowed fields.

### Step 4: Add or update focused tests

Existing tests include `tests/profile-query.test.mjs` and
`tests/profile-games.test.mjs`. Add tests for any pure helper introduced to
decide the data shape, or extend existing tests if you move filtering/sorting
behavior.

If no pure helper is introduced, add a lightweight test that protects the
profile query parsing behavior used before data loading.

**Verify**: `npm test` -> exit 0.

### Step 5: Run full verification

**Verify**:

- `npm run lint` -> exit 0; existing `next/image` warnings may remain.
- `npm run typecheck` -> exit 0.
- `npm test` -> exit 0.

## Test plan

- Prefer pure tests for query parsing and profile data-shape decisions.
- Keep existing profile filtering and sorting tests passing.
- If adding a new helper, put its tests beside the existing profile tests and
  use Node's built-in runner.

## Done criteria

- [ ] `/profile` parses `activeTab` before profile data loading.
- [ ] The base profile query no longer always includes all game entries and all
  journal entries with media.
- [ ] Games tab behavior remains intact.
- [ ] Journal tab behavior remains intact.
- [ ] Overview, integrations, setup, assistant, and player-profile tabs do not
  depend on full game/journal collections unless explicitly justified in code.
- [ ] `npm run lint`, `npm run typecheck`, and `npm test` exit 0.
- [ ] No files outside the in-scope list are modified.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- The profile components have been substantially redesigned since this plan was
  written.
- Keeping current behavior requires adding client-side data fetching.
- The change requires schema changes.
- A verification command fails twice after a reasonable fix attempt.

## Maintenance notes

This plan intentionally avoids UI pagination, but it should leave the codebase
ready for a future paginated Games tab. Reviewers should check that the calm
overview path no longer loads data it cannot render.
