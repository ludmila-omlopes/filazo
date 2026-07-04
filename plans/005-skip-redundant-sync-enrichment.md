# Plan 005: Stop re-running external metadata enrichment for every game on every library sync

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 36636b8..HEAD -- src/lib/catalog.ts`
> If `src/lib/catalog.ts` changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (touches the canonical game-resolution path — protected by the guard-only design below)
- **Depends on**: plans/004-verification-baseline-tests-ci.md (test harness must exist)
- **Category**: perf
- **Planned at**: commit `36636b8`, 2026-07-01
- **Issue**: https://github.com/ludmila-omlopes/filazo/issues/93

## Why this matters

Every provider library sync (Steam/PlayStation/Xbox) calls `resolveCatalogGame` once per game, and `resolveCatalogGame` **unconditionally** fires external HTTP searches: IGDB (unless the caller passed metadata — sync callers don't), and HLTB + Metacritic **always**, even when the game is already fully enriched in the database. A user with 500 Steam games who clicks "sync" a second time triggers ~1,500 sequential external HTTP calls that can change nothing, making re-syncs take minutes inside a single server action and hammering third-party APIs. The fix is to guard the external calls with the same "only if data is missing" conditions that already exist elsewhere in this file (`enrichMissingGameDetailData`), keeping first-sync behavior identical.

## Current state

`src/lib/catalog.ts` (~36KB) is the canonical-catalog module. Per repo rules (AGENTS.md): the canonical resolution flow must be preserved — external providers attach to one internal `Game`; matching priority is provider ID → IGDB ID → normalized title. This plan must not change matching results for games that are missing data; it only skips *redundant* lookups for games that already have it.

The hot function (read it in full before editing):

```ts
// src/lib/catalog.ts:317-356 (abridged)
export async function resolveCatalogGame(input: ResolveGameInput) {
  const normalizedTitle = normalizeTitle(input.title);
  const searchTitle = cleanGameTitle(input.title);
  let game /* ... */ = null;

  if (input.provider && input.providerGameId) {
    const existingLink = await prisma.gameProviderLink.findUnique({
      where: { provider_providerGameId: { provider: input.provider, providerGameId: input.providerGameId } },
      include: { game: true },
    });
    if (existingLink) {
      game = existingLink.game;
    }
  }

  if (!game) {
    game = await prisma.game.findFirst({ where: { normalizedName: normalizedTitle } });
  }

  const metadata =
    input.metadata ??
    (await igdbAdapter.searchBestMatch({          // ← external HTTP, runs whenever caller passed no metadata
      title: searchTitle,
      platformName: input.platformName,
    }));
```

```ts
// src/lib/catalog.ts:367-377 — external HTTP, runs UNCONDITIONALLY on every call
  const completionTimes = await hltbAdapter.searchBestMatch({
    title: cleanGameTitle(metadata?.name ?? input.title),
    platformName: input.platformName,
  });
  const reviewScore = await metacriticAdapter.searchBestMatch({
    title: cleanGameTitle(metadata?.name ?? input.title),
    steamAppId: input.provider === ExternalProvider.STEAM ? input.providerGameId : null,
  });
```

Downstream, the results are applied **conditionally** (this is the pattern to hoist into guards):

```ts
// src/lib/catalog.ts:400-424 (abridged)
  if (metadata && (!game.igdbId || !game.coverUrl || !game.heroUrl || !game.summary)) {
    game = await applyMetadataToExistingGame(game.id, metadata);
  } else if (!game.coverUrl || !game.heroUrl) {
    game = await applyProviderArtworkFallback(game.id, game, input);
  }

  if (completionTimes && (!game.hltbMainStoryMinutes || !game.hltbMainExtraMinutes || !game.hltbCompletionistMinutes)) {
    game = await applyCompletionTimesToGame(game.id, completionTimes);
  }

  if (reviewScore && (game.metacriticScore !== reviewScore.score || game.metacriticUrl !== reviewScore.url)) {
    game = await applyReviewScoreToGame(game.id, reviewScore);
  }
```

Additional facts you need:

- After the HLTB fetch there is an HLTB-provider-link lookup (`catalog.ts:379-392`) that can reassign `game` — a cross-provider merge path. If HLTB search is skipped for an already-enriched game, this merge path is skipped too; that is acceptable because it can only trigger when HLTB data was fetched.
- `metadata?.igdbId` is also used at `catalog.ts:358-365` (IGDB-id game lookup) and `catalog.ts:449+` (IGDB provider-link upsert). Skipping the IGDB search for an already-enriched game therefore also skips those — acceptable for a game that already has `igdbId` set, which is exactly the guard condition.
- The existing conditional-enrichment exemplar to imitate: `enrichMissingGameDetailData` at `catalog.ts:1199-1254` guards each adapter call with "is the data missing" checks (`!game.igdbId || !game.summary || ...`).
- Sync call sites that pass no `metadata` and loop per game: Steam `catalog.ts:514-522`, PlayStation (loop starts after `catalog.ts:568`), Xbox (loop after ~`catalog.ts:668`). CSV import also routes through `resolveCatalogGame`.
- The Metacritic condition `game.metacriticScore !== reviewScore.score` re-checks for *changed* scores; a plain "skip if present" guard would freeze scores. The guard below uses a staleness window instead — `Game.metacriticUpdatedAt` exists in the schema (`prisma/schema.prisma:154`), as do `hltbUpdatedAt` (:151).

## Commands you will need

| Purpose   | Command             | Expected on success |
|-----------|---------------------|---------------------|
| Install   | `npm install`       | exit 0              |
| Typecheck | `npm run typecheck` (from plan 004; else `npx tsc --noEmit`) | exit 0 |
| Lint      | `npm run lint`      | exit 0 (3 `no-img-element` warnings OK) |
| Tests     | `npm test`          | exit 0, all pass    |

## Scope

**In scope** (the only files you should modify):
- `src/lib/catalog.ts` — only within `resolveCatalogGame` and a new small pure helper
- `src/lib/enrichment-policy.ts` (create — pure decision functions, unit-testable)
- `src/lib/enrichment-policy.test.ts` (create)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- The matching-priority logic (provider link → normalized name → IGDB id → HLTB link) — order and semantics stay identical when fetches do happen.
- `enrichMissingGameDetailData` and the game-detail page path.
- Sync loop bodies in `syncSteamLibraryForUser` / PlayStation / Xbox functions — no batching/concurrency work here (separate future plan; see Maintenance notes).
- `src/lib/igdb.ts`, `src/lib/hltb.ts`, `src/lib/metacritic.ts` adapters.
- `prisma/schema.prisma`.

## Git workflow

- Branch: `advisor/005-skip-redundant-sync-enrichment`
- Commits: helper+tests first, then the wiring; short imperative subjects
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Pure enrichment-policy helper

Create `src/lib/enrichment-policy.ts` with three pure functions taking the already-loaded `game` row (or `null` when no game matched yet):

```ts
type GameEnrichmentFields = {
  igdbId: number | null;
  summary: string | null;
  coverUrl: string | null;
  heroUrl: string | null;
  hltbMainStoryMinutes: number | null;
  hltbMainExtraMinutes: number | null;
  hltbCompletionistMinutes: number | null;
  hltbUpdatedAt: Date | null;
  metacriticScore: number | null;
  metacriticUpdatedAt: Date | null;
} | null;

const METACRITIC_REFRESH_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const HLTB_REFRESH_MS = 1000 * 60 * 60 * 24 * 90; // 90 days

export function shouldSearchIgdb(game: GameEnrichmentFields): boolean {
  if (!game) return true; // new game — full enrichment
  return !game.igdbId || !game.summary || !game.coverUrl || !game.heroUrl;
}

export function shouldSearchHltb(game: GameEnrichmentFields, now = new Date()): boolean {
  if (!game) return true;
  const missing =
    !game.hltbMainStoryMinutes || !game.hltbMainExtraMinutes || !game.hltbCompletionistMinutes;
  if (!missing) return false;
  // Missing fields but checked recently: don't re-ask HLTB every sync for
  // games it simply doesn't have (many niche titles).
  if (game.hltbUpdatedAt && now.getTime() - game.hltbUpdatedAt.getTime() < HLTB_REFRESH_MS) {
    return false;
  }
  return true;
}

export function shouldSearchMetacritic(game: GameEnrichmentFields, now = new Date()): boolean {
  if (!game) return true;
  if (game.metacriticScore === null) {
    return !game.metacriticUpdatedAt ||
      now.getTime() - game.metacriticUpdatedAt.getTime() >= METACRITIC_REFRESH_MS;
  }
  return !game.metacriticUpdatedAt ||
    now.getTime() - game.metacriticUpdatedAt.getTime() >= METACRITIC_REFRESH_MS;
}
```

Check before relying on `hltbUpdatedAt`/`metacriticUpdatedAt` semantics: `grep -n "hltbUpdatedAt\|metacriticUpdatedAt" src/lib/catalog.ts` — confirm the apply helpers (`applyCompletionTimesToGame`, `applyReviewScoreToGame`) set these timestamps when writing. If they are only set on successful writes (not on empty search results), the "checked recently" branch of `shouldSearchHltb` will never fire for perpetually-missing games; that is acceptable — note it and keep the simpler behavior (the guard still eliminates re-fetches for *enriched* games, which is the bulk of the win).

**Verify**: `npm run typecheck` → exit 0

### Step 2: Unit tests for the policy

Create `src/lib/enrichment-policy.test.ts` (Node built-in runner, relative import with `.ts` extension — pattern per `src/lib/utils.test.ts` from plan 004).

Cases:
1. `null` game → all three return `true`.
2. Fully enriched game (all fields set, fresh timestamps) → all three return `false`.
3. Game with `igdbId` but no `coverUrl` → `shouldSearchIgdb` → `true`.
4. HLTB fields complete → `shouldSearchHltb` → `false` even with old timestamp.
5. HLTB fields missing, `hltbUpdatedAt` 10 days ago → `false`; 100 days ago → `true`; `null` → `true`.
6. `metacriticScore` set, `metacriticUpdatedAt` 5 days ago → `false`; 60 days ago → `true`.

**Verify**: `npm test` → exit 0, new tests pass

### Step 3: Wire the guards into resolveCatalogGame

In `resolveCatalogGame` (`src/lib/catalog.ts:317`), after the provider-link and normalized-name lookups have produced `game` (possibly `null`):

1. IGDB (replace lines ~351-356):

```ts
const metadata =
  input.metadata ??
  (shouldSearchIgdb(game)
    ? await igdbAdapter.searchBestMatch({ title: searchTitle, platformName: input.platformName })
    : null);
```

2. HLTB (lines ~367-370): wrap with `shouldSearchHltb(game)` → `const completionTimes = shouldSearchHltb(game) ? await hltbAdapter.searchBestMatch({...}) : null;`
3. Metacritic (lines ~371-377): same with `shouldSearchMetacritic(game)`.

Everything downstream already handles `metadata`/`completionTimes`/`reviewScore` being `null`/falsy (see the conditional apply blocks in Current state) — confirm by reading lines 358-472 end to end; the IGDB-id lookup (`if (metadata?.igdbId)`), HLTB-link lookup (`if (completionTimes?.hltbId)`), game-create fallback (`metadataToGameCreateInput(input.title, metadata)` — verify it tolerates `null` metadata; it must, because IGDB search can already return null today when IGDB is unconfigured), and the two provider-link upserts are all already guarded.

Important subtlety: `game` can be reassigned by the IGDB-id and HLTB-link lookups after the guards ran. The guards use the *initially matched* game, which is correct: they decide whether to spend the external call at all.

**Verify**: `npm run typecheck` → exit 0

**Verify**: `npm run lint` → exit 0

**Verify**: `npm test` → exit 0

### Step 4: Behavioral spot-check (no external keys needed)

The IGDB/HLTB/Metacritic adapters are best-effort and return null when unconfigured (repo rule: enrichment must not break sync). With no API keys in env, run whatever cheap end-to-end path exists — if `npm run dev` starts and a CSV import or manual game add can be exercised against a local database, do it; otherwise state plainly in your report that runtime verification was limited to typecheck+tests because provider/API keys and a seeded DB are unavailable. Do not fake a verification.

## Test plan

Step 2's unit tests cover the decision logic exhaustively. The integration behavior ("second sync fires no external calls for enriched games") is intentionally left to the policy tests + code review, since there is no HTTP-mocking infrastructure in the repo yet — adding one is out of scope. State this limitation in your report.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run typecheck` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm test` exits 0 including the new policy tests
- [ ] In `resolveCatalogGame`, no adapter `searchBestMatch` call remains unconditional: `hltbAdapter.searchBestMatch` and `metacriticAdapter.searchBestMatch` inside `resolveCatalogGame` are both behind `shouldSearch*` guards (verify by reading the diff)
- [ ] `enrichMissingGameDetailData` is untouched (`git diff src/lib/catalog.ts` shows changes only inside `resolveCatalogGame`)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The `resolveCatalogGame` excerpts don't match the live code (drift).
- `metadataToGameCreateInput` does NOT tolerate null metadata (i.e., a brand-new title with IGDB skipped/unavailable would crash) — this breaks the "IGDB optional" repo rule and means the current code has a different shape than planned.
- The apply helpers do not set `hltbUpdatedAt`/`metacriticUpdatedAt` at all (grep from Step 1 finds no writes) AND removing the staleness branches would leave `shouldSearchMetacritic` unable to ever return true for a score refresh — report rather than redesign.
- You find that sync callers depend on `resolveCatalogGame` returning IGDB-refreshed data on every call (e.g., a caller reads `metadata` transitively) — none found in this audit, but if you see one, stop.

## Maintenance notes

- This is the guard-only slice of a larger sync-performance track. Deliberately deferred: bounded-concurrency processing of the sync loop, batching the per-game Prisma lookups (provider links + normalized names prefetch), and moving enrichment to a post-response background pass (`after()`). Each is a separate future plan; they compound with this one.
- Reviewer should scrutinize: no change in behavior for brand-new games (all guards return true for `null` game), and the Metacritic staleness window as a product decision (30 days — cheap to change).
- If a future feature needs to force re-enrichment (e.g., "refresh metadata" button), add an options parameter to `resolveCatalogGame` rather than weakening the guards.
