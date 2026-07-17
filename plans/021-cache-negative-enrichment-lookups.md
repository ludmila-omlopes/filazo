# Plan 021: Cache negative enrichment lookups so unmatched games stop hitting IGDB/HLTB/Metacritic on every sync

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6fa54f4..HEAD -- src/lib/catalog.ts src/lib/enrichment-policy.ts src/lib/enrichment-policy.test.ts prisma/schema.prisma`
> This plan was written against branch `feat/feedback-admin-reorg` at commit
> `6fa54f4` **plus uncommitted changes** to `src/lib/catalog.ts`. If the
> excerpts under "Current state" do not match your checkout, treat it as a
> STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (touches the canonical resolution path and the schema — guard-only design, no matching changes)
- **Depends on**: none (plan 005 — DONE — added the success-path guards this plan completes)
- **Category**: perf
- **Planned at**: commit `6fa54f4`, 2026-07-17
- **Issue**: https://github.com/ludmila-omlopes/filazo/issues/142

## Why this matters

Plan 005 (done) made library syncs skip enrichment for games that already
*have* data. The remaining gap: the "already enriched" markers (`igdbId`,
`hltbUpdatedAt`, `metacriticUpdatedAt`) are only written on **success**. A
game that gets **no match** — obscure titles, mods, soundtracks, delisted
apps, which every real library contains — is re-searched against IGDB, HLTB,
and Metacritic on *every sync of every user who owns it*, daily via the
scheduler. This inflates sync duration toward the 45s per-account timeout
(a direct cause of PlayStation syncs "feeling stuck"), and burns third-party
rate limits for lookups that will return nothing again.

A second instance of the same gap: `enrichMissingGameDetailData` (game detail
page) triggers a Metacritic search whenever `metacriticScore === null`,
bypassing even the 30-day refresh throttle — a no-score game is searched on
every page view.

The fix: record *when each provider was last searched* (regardless of
outcome) in three new nullable `Game` columns, and make the existing policy
helpers consult them.

## Current state

- `prisma/schema.prisma` — `model Game` at line 196; enrichment fields
  `igdbId Int? @unique` (212), `hltbUpdatedAt DateTime?` (217),
  `metacriticUpdatedAt DateTime?` (220).
- `prisma/migrations/` — real migration history exists (e.g.
  `20260716120000_add_feedback`); `scripts/init-db.mjs` wraps
  `prisma migrate deploy`. New migrations are created with
  `npx prisma migrate dev --name <name>` (requires a reachable dev
  `DATABASE_URL`).
- `src/lib/enrichment-policy.ts` (63 lines) — the three pure guards. Current
  shape:

```ts
// src/lib/enrichment-policy.ts:17-23
export function shouldSearchIgdb(game: GameEnrichmentFields): boolean {
  if (!game) {
    return true;
  }

  return !game.igdbId || !game.summary || !game.coverUrl || !game.heroUrl;
}
```

`shouldSearchHltb` (25-49) additionally returns false when `hltbUpdatedAt` is
younger than `HLTB_REFRESH_MS` (90 days); `shouldSearchMetacritic` (51-63)
returns true when `metacriticUpdatedAt` is null or older than
`METACRITIC_REFRESH_MS` (30 days). `GameEnrichmentFields` (1-12) lists the
fields these receive.

- `src/lib/enrichment-policy.test.ts` — existing tests for these guards;
  the pattern to extend.
- `src/lib/catalog.ts` — `resolveCatalogGame` (345-510) calls the guards with
  `initiallyMatchedGame` and fires the adapapter searches at 381-414; the
  success-only writes happen in `applyMetadataToExistingGame` (231),
  `applyCompletionTimesToGame` (261, sets `hltbUpdatedAt`),
  `applyReviewScoreToGame` (304, sets `metacriticUpdatedAt`).
  `enrichMissingGameDetailData` (1498-1553) is the detail-page path; its
  Metacritic condition at 1531 is `if (game.metacriticScore === null)`.

Excerpt — the search block in `resolveCatalogGame`
(`src/lib/catalog.ts:380-414`, abridged):

```ts
  const initiallyMatchedGame = game;
  const metadata =
    input.metadata ??
    (shouldSearchIgdb(initiallyMatchedGame)
      ? await igdbAdapter.searchBestMatch({ ... })
      : null);
  ...
  const completionTimes = shouldSearchHltb(initiallyMatchedGame)
    ? await hltbAdapter.searchBestMatch({ ... })
    : null;
  const reviewScore = shouldSearchMetacritic(initiallyMatchedGame)
    ? await metacriticAdapter.searchBestMatch({ ... })
    : null;
```

Repo rules that bind this plan (AGENTS.md): preserve the canonical
resolution flow; if the data model changes, keep `prisma/schema.prisma`,
`scripts/init-db.mjs`, and `README.md` in sync (init-db.mjs is a generic
wrapper — no change needed there; check README only if it documents Game
columns).

## Commands you will need

| Purpose   | Command                                                        | Expected on success            |
|-----------|----------------------------------------------------------------|--------------------------------|
| Install   | `npm install`                                                  | exit 0                         |
| Migration | `npx prisma migrate dev --name add_enrichment_checked_at`      | new folder under `prisma/migrations/`, exit 0 |
| Generate  | `npx prisma generate`                                          | exit 0                         |
| Lint      | `npm run lint`                                                 | exit 0                         |
| Typecheck | `npm run typecheck`                                            | exit 0, no errors              |
| Tests     | `npm test`                                                     | all pass                       |

## Scope

**In scope** (the only files you should modify/create):
- `prisma/schema.prisma` (three new nullable columns on `Game`)
- `prisma/migrations/<timestamp>_add_enrichment_checked_at/` (generated)
- `src/lib/enrichment-policy.ts`
- `src/lib/enrichment-policy.test.ts`
- `src/lib/catalog.ts` (only: the checked-at bookkeeping in
  `resolveCatalogGame` and the guard conditions in
  `enrichMissingGameDetailData`)
- `README.md` (only if it documents Game columns — check first)

**Out of scope** (do NOT touch):
- The adapters (`igdb.ts`, `hltb.ts`, `metacritic.ts`).
- Matching logic in `resolveCatalogGame` — which game a title resolves to
  must be unchanged; this plan only changes *whether a search fires* and
  *bookkeeping after it fires*.
- The success-path writes (`applyMetadataToExistingGame`,
  `applyCompletionTimesToGame`, `applyReviewScoreToGame`).

## Git workflow

- Branch: `advisor/021-cache-negative-enrichment-lookups`.
- Commit message style: short imperative sentence, e.g.
  `Cache negative enrichment lookups per provider`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Schema + migration

Add to `model Game` in `prisma/schema.prisma`, next to the existing
enrichment fields:

```prisma
  igdbCheckedAt             DateTime?
  hltbCheckedAt             DateTime?
  metacriticCheckedAt       DateTime?
```

Run `npx prisma migrate dev --name add_enrichment_checked_at`.

**Verify**: `ls prisma/migrations | tail -1` → the new folder;
`npm run typecheck` → exit 0.

### Step 2: Teach the policy helpers about attempt timestamps

In `src/lib/enrichment-policy.ts`:

1. Extend `GameEnrichmentFields` with
   `igdbCheckedAt: Date | null; hltbCheckedAt: Date | null; metacriticCheckedAt: Date | null;`.
2. Add `const IGDB_RECHECK_MS = 1000 * 60 * 60 * 24 * 7;` (7 days — IGDB has
   no refresh cadence today, so this only throttles repeat *failures*).
3. Add a private helper:

```ts
function isFresh(checkedAt: Date | null, maxAgeMs: number, now: Date) {
  return Boolean(checkedAt) && now.getTime() - checkedAt!.getTime() < maxAgeMs;
}
```

4. Change the guards (keep their existing "data missing" logic intact, add
   the freshness short-circuit):
   - `shouldSearchIgdb(game, now = new Date())`: after the null-game check,
     return `false` when `isFresh(game.igdbCheckedAt, IGDB_RECHECK_MS, now)`;
     otherwise keep the current missing-data expression.
   - `shouldSearchHltb`: replace the `game.hltbUpdatedAt` freshness check
     with `isFresh(game.hltbCheckedAt, HLTB_REFRESH_MS, now)` **while keeping
     `hltbUpdatedAt` in the type** (other code reads it). Keep the
     missing-data check first.
   - `shouldSearchMetacritic`: replace the `metacriticUpdatedAt` expression
     with `return !isFresh(game.metacriticCheckedAt, METACRITIC_REFRESH_MS, now);`
     (same 30-day cadence, now attempt-based).

**Verify**: `npm run typecheck` → exit 0 (expect compile errors in
`enrichment-policy.test.ts` until Step 3 — if the *only* errors are in that
test file, proceed).

### Step 3: Extend the policy tests

In `src/lib/enrichment-policy.test.ts`, update existing fixtures for the new
fields (add the three `...CheckedAt: null` to whatever base fixture objects
exist — follow the file's current fixture style), then add cases:

- `shouldSearchIgdb` → `false` when data is missing but `igdbCheckedAt` is
  2 days old; `true` when it is 8 days old; `true` when null.
- `shouldSearchHltb` → `false` when times are missing but `hltbCheckedAt`
  is 30 days old; `true` when 91 days old.
- `shouldSearchMetacritic` → `false` when score is null but
  `metacriticCheckedAt` is 10 days old; `true` when 31 days old.

Use the injectable `now` parameter — do not rely on real time.

**Verify**: `npm test` → all pass including the new cases.

### Step 4: Record attempts in `resolveCatalogGame`

In `src/lib/catalog.ts`, `resolveCatalogGame`:

1. Capture which searches ran. The IGDB search currently hides inside a `??`
   chain — restructure minimally:

```ts
  const ranIgdbSearch = !input.metadata && shouldSearchIgdb(initiallyMatchedGame);
  const metadata =
    input.metadata ??
    (ranIgdbSearch
      ? await igdbAdapter.searchBestMatch({
          title: searchTitle,
          platformName: input.platformName,
        })
      : null);
```

   and equivalently `const ranHltbSearch = shouldSearchHltb(initiallyMatchedGame);`
   / `const ranMetacriticSearch = shouldSearchMetacritic(initiallyMatchedGame);`
   feeding the existing ternaries.

2. After the `game` is guaranteed to exist and all `apply*` calls have run
   (immediately before the `if (input.provider && input.providerGameId)`
   provider-link block at ~line 463), write the attempt timestamps in one
   update:

```ts
  const checkedAtData = {
    ...(ranIgdbSearch ? { igdbCheckedAt: new Date() } : {}),
    ...(ranHltbSearch ? { hltbCheckedAt: new Date() } : {}),
    ...(ranMetacriticSearch ? { metacriticCheckedAt: new Date() } : {}),
  };
  if (Object.keys(checkedAtData).length > 0) {
    game = await prisma.game.update({
      where: { id: game.id },
      data: checkedAtData,
    });
  }
```

Newly created games also get stamped by this (their searches ran with
`initiallyMatchedGame === null`).

**Verify**: `npm run typecheck` → exit 0.

### Step 5: Route the detail page through the same policy

In `enrichMissingGameDetailData` (`src/lib/catalog.ts:1498-1553`):

- Replace the IGDB condition
  `if (!game.igdbId || !game.summary || !game.genres || !game.platforms)`
  with `if (shouldSearchIgdb(game))`.
- Replace the HLTB condition (the three `!game.hltb*Minutes` checks) with
  `if (shouldSearchHltb(game))`.
- Replace `if (game.metacriticScore === null)` with
  `if (shouldSearchMetacritic(game))`.
- After each search **attempt** (inside each `if`, after the `await`,
  regardless of whether a result came back), update the matching
  `...CheckedAt` on the game via `prisma.game.update`.

The `game` parameter here is a full `Game` payload, so the new columns are
present after `prisma generate`.

**Verify**: `npm run lint` → exit 0; `npm run typecheck` → exit 0;
`npm test` → all pass.

### Step 6: README sync check

`grep -n "hltbUpdatedAt\|metacriticUpdatedAt\|igdbId" README.md` — if the
README documents Game enrichment columns, add the three new ones in the same
style; if it returns nothing, no README change (note that in your report).

## Test plan

- Extended cases in `src/lib/enrichment-policy.test.ts` per Step 3 (six new
  assertions minimum: fresh-vs-stale for each of the three providers).
- No DB-integration tests — `resolveCatalogGame` is not loadable under the
  node test runner (aliased imports, Prisma singleton); the policy tests are
  the behavioral contract.
- Verification: `npm test` → all pass.

## Done criteria

ALL must hold:

- [ ] `npm run lint` exits 0
- [ ] `npm run typecheck` exits 0
- [ ] `npm test` exits 0 and `enrichment-policy.test.ts` includes fresh/stale cases for all three providers
- [ ] A migration folder `*_add_enrichment_checked_at` exists under `prisma/migrations/`
- [ ] `grep -n "metacriticScore === null" src/lib/catalog.ts` returns no matches
- [ ] `grep -c "CheckedAt" src/lib/enrichment-policy.ts` ≥ 3
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `npx prisma migrate dev` fails with drift errors against your dev database
  — do not run `prisma db push` or `migrate reset` to force it; report the
  drift output.
- The search block in `resolveCatalogGame` no longer matches the excerpt
  (the `shouldSearch*` guards missing entirely would mean plan 005's work
  was reverted).
- Making the guards consult the new columns requires changing which game a
  title resolves to (it must not — if you find yourself editing the lookup
  logic at catalog.ts:354-378, stop).

## Maintenance notes

- Tuning knobs: `IGDB_RECHECK_MS` (7d) is a judgment call — newly released
  games gain IGDB entries over time, so don't raise it aggressively.
- Plan 023 also edits `resolveCatalogGame`; execute 021 before 023 (index
  order) to avoid conflicts.
- Reviewer should scrutinize: `ranIgdbSearch` must be false when the caller
  passed `input.metadata` (CSV/manual paths pass metadata in — stamping
  `igdbCheckedAt` for a search that didn't run would suppress a legitimate
  future search).
- Deferred follow-up (tracked in plans/README "Vetted but not planned"):
  bounded concurrency + batched prefetch for the per-game sync loop itself.
