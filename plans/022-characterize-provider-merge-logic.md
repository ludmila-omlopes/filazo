# Plan 022: Characterization tests for PlayStation/Xbox library merging and sync error classification

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6fa54f4..HEAD -- src/lib/playstation.ts src/lib/xbox.ts src/lib/platform-sync-policy.ts src/lib/platform-sync-policy.test.ts`
> This plan was written against branch `feat/feedback-admin-reorg` at commit
> `6fa54f4` **plus uncommitted changes** to `src/lib/platform-sync-policy.ts`
> and its test (manual-cooldown removal). If the excerpts under "Current
> state" do not match your checkout, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW-MED (pure code moves; behavior must not change)
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `6fa54f4`, 2026-07-17
- **Issue**: https://github.com/ludmila-omlopes/filazo/issues/143

## Why this matters

The sync area is the highest-churn code in this repo (nearly every recent
commit touches it), and its trickiest pure logic — the PlayStation
three-source merge, the Xbox two-source merge, and platform-sync error
classification — has zero tests. These functions decide which external
records collapse into one game, which playtime/completion value wins, and
how failures are retried. Refactors already planned for this area (see plan
023 and the "sync loop latency" backlog item) are risky without a behavioral
baseline. This plan extracts the pure functions into test-loadable modules
(the established repo pattern — `steam-library.ts` was extracted the same
way) and pins their **current** behavior with characterization tests.

Characterization rule: tests document what the code does **today**. If you
observe behavior that looks wrong, write the test asserting the observed
behavior and flag it in your report — do not fix it.

## Current state

The node test runner (`npm test` → `node --experimental-strip-types --test`)
cannot resolve the `@/` import alias, so testable modules must use only
relative imports (with explicit `.ts` extension) or type-only imports.
Exemplar of the extraction pattern: `src/lib/steam-library.ts` +
`src/lib/steam-library.test.ts`. Exemplar of relative `.ts` imports in app
code: `src/app/profile/_components/profile-query.ts` imports
`"../../../lib/i18n.ts"`.

Files and the pure functions currently trapped inside them:

- `src/lib/playstation.ts` (778 lines) — PSN integration. Pure functions at:
  - `parsePlayStationDate` (292), `parsePlayStationDurationMinutes` (301) —
    ISO-8601 duration parsing with comma-decimal support,
  - `isPlayStationNonGameCategory` (323), `getPlayStationPlayedPlatformName`
    (337), `normalizePlayStationPlatformName` (358),
    `formatPlayStationPlatform` (380), `createConceptStoreUrl` (389),
    `createProviderGameIds` (395), `uniqueValues` (413),
    `getSyncedGameProviderGameIds` (419),
  - `mapTitleToSyncedGame` (423), `mapPurchasedGameToSyncedGame` (457),
    `mapPlayedGameToSyncedGame` (495) — depend only on **types** from
    `psn-api` and `SyncedLibraryGame` from
    `src/lib/providers/contracts.ts` (a types-only module),
  - `mergePlayStationSyncedGames` (600-677) — the three-source merge.
  - Everything else in the file (crypto, token refresh, fetch pagination,
    prisma writes) is NOT pure and stays put.
- `src/lib/xbox.ts` (801 lines) — Xbox integration. Pure functions at:
  - `parseXboxDate` (482), `calculateCompletionPercent` (491),
    `uniqueValues` (527), `mapPlatform` (533), `pickTitleHubImage` (545),
  - `mergeXboxTitles` (603-678) — merges title-hub and achievement history;
    depends on the local types `XboxTitleHistoryItem` (68) and
    `XboxTitleHubItem` (80), and `SyncedLibraryGame`.
- `src/lib/platform-sync-policy.ts` (230 lines) — already import-free and
  therefore already testable in place: `classifyPlatformSyncError` (125),
  `getRetryAfterMs` (183, private), `sanitizePlatformSyncError` (209).
  `src/lib/platform-sync-policy.test.ts` exists and covers scheduling/backoff
  but not classification or sanitization.
- `src/lib/utils.ts` — exports `normalizeTitle` (needed by the PSN merge);
  verify it has no `@/` imports before importing it relatively
  (`grep -n "^import" src/lib/utils.ts`).

Key merge behaviors to pin (read the functions in full before writing
tests; line refs from the working tree):

- PSN merge (`playstation.ts:600-677`): entries keyed both by
  `provider:<id>` and `title:<normalized>`; on merge, `providerGameId`
  prefers a `titleId:`-prefixed id; `platformName` values are joined with
  `", "`; `lastPlayedAt` takes the max; `playtimeMinutes` takes the incoming
  value when it is not `undefined` (note: incoming `null` **overwrites** an
  existing number — characterize this as-is); `rawData` accumulates a
  `playStationSyncSources` array.
- Xbox merge (`xbox.ts:603-678`): title-hub entries are inserted first;
  achievement-history entries merge into them with `existing?.field ?? ...`
  precedence (title-hub wins for title/platform/completion/lastPlayed).
- `calculateCompletionPercent` precedence: `progressPercentage` >
  earned/total achievements > gamerscore ratio > null; results clamped 0-100.
- `classifyPlatformSyncError` (`platform-sync-policy.ts:125-181`): message
  keyword → code mapping (abort/timeout → TIMEOUT; 429/rate limit →
  RATE_LIMIT; "api key is required"/"not configured" → CONFIGURATION;
  401/403/unauthorized/"token expired" → AUTH; fetch/econn/enotfound →
  NETWORK; other 4xx/5xx → PROVIDER; else INTERNAL). Note the sanitizer runs
  **first** and replaces URLs with `[url]`, so URL contents never influence
  classification. `retryAfterMs` comes from an error's
  `retryAfter`/response-header field or a `retry-after: N` pattern in the
  message.

## Commands you will need

| Purpose   | Command             | Expected on success |
|-----------|---------------------|---------------------|
| Install   | `npm install`       | exit 0              |
| Lint      | `npm run lint`      | exit 0              |
| Typecheck | `npm run typecheck` | exit 0, no errors   |
| Tests     | `npm test`          | all pass            |

## Scope

**In scope** (the only files you should modify/create):
- `src/lib/playstation-library.ts` (create — extracted pure functions)
- `src/lib/playstation-library.test.ts` (create)
- `src/lib/xbox-library.ts` (create)
- `src/lib/xbox-library.test.ts` (create)
- `src/lib/playstation.ts` (remove moved code, import from the new module)
- `src/lib/xbox.ts` (same)
- `src/lib/platform-sync-policy.test.ts` (extend)

**Out of scope** (do NOT touch):
- `src/lib/catalog.ts`, `src/lib/platform-sync.ts`,
  `src/lib/platform-sync-policy.ts` (the policy module itself — tests only).
- The duplicated crypto helpers (`encryptSecret`/`decryptSecret`/
  `isFutureDate`) in playstation.ts/xbox.ts — known duplication, tracked in
  plans/README.md; consolidating them is NOT part of this plan.
- `src/lib/playstation-catalog.ts` — different module (artwork/title
  canonicalization), already tested.

## Git workflow

- Branch: `advisor/022-characterize-provider-merge-logic`.
- Commit per logical unit (one commit per extraction + its tests is ideal);
  message style: short imperative sentence, e.g.
  `Extract and characterize PlayStation library merging`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Extract `src/lib/playstation-library.ts`

Create the module and **move** (cut, not copy) the pure functions listed in
"Current state" from `playstation.ts`, preserving bodies byte-identical.
Imports for the new module:

```ts
import type { PurchasedGame, TrophyTitle } from "psn-api";
import type { SyncedLibraryGame } from "./providers/contracts.ts";
import { normalizeTitle } from "./utils.ts";
```

(`import type` is erased by type stripping; `psn-api` and contracts add no
runtime load. If `grep -n "^import" src/lib/utils.ts` shows any `@/` import,
STOP.)

The `PlayStationPlayedGame` type (`playstation.ts:491-493`) derives from
`getUserPlayedGames` — redefine it in the new module structurally instead
(the fields used by `mapPlayedGameToSyncedGame`: `titleId`, `name`,
`localizedName`, `category`, `concept`, `playDuration`,
`firstPlayedDateTime`, `lastPlayedDateTime`, `imageUrl`,
`localizedImageUrl`, `media`, `playCount`, `service`) and export it. In
`playstation.ts`, import everything moved from `"@/lib/playstation-library"`
and delete the local copies. Where `playstation.ts` used the derived type,
the structural type must be assignment-compatible with what
`getUserPlayedGames` returns — if it is not, STOP and report the mismatch.

Export every moved function (tests need them).

**Verify**: `npm run typecheck` → exit 0; `npm run lint` → exit 0.

### Step 2: Characterize the PSN logic

Create `src/lib/playstation-library.test.ts` (model after
`src/lib/steam-library.test.ts`; import from
`"./playstation-library.ts"`). Minimum cases:

1. `parsePlayStationDurationMinutes`: `"PT2H30M"` → 150; `"P1DT1H"` → 1500;
   `"PT90S"` → 2 (rounds); `"PT1,5H"` → 90 (comma decimals); `"garbage"` →
   null; `null` → null.
2. `mergePlayStationSyncedGames` with one purchased + one trophy + one
   played entry for the same title (link them the way real data does — e.g.
   played and purchased share a `titleId:` provider id, trophy shares only
   the normalized title): assert one merged game; provider ids are the union;
   `providerGameId` is the `titleId:`-prefixed one; completion comes from the
   trophy entry; playtime and `lastPlayedAt` from the played entry;
   `rawData.playStationSyncSources` has 3 entries in insertion order.
3. Two different titles stay separate (no accidental merge).
4. The playtime overwrite quirk: an existing merged game with
   `playtimeMinutes: 120` merged with an incoming entry whose
   `playtimeMinutes` is `null` (not undefined) ends up `null`. Assert the
   observed behavior and add a `// characterization:` comment.
5. `isPlayStationNonGameCategory`: `"ps4NonGameMediaApp"` → true, `"ps5NativeGame"`
   → false, `null` → false. (Run the function to confirm exact fixtures.)
6. `formatPlayStationPlatform("PS4,PS5")` → `"PlayStation PS4, PlayStation PS5"`
   (confirm by reading `normalizePlayStationPlatformName` — adjust expected
   string to actual output, not to this plan).

**Verify**: `npm test` → all pass.

### Step 3: Extract `src/lib/xbox-library.ts`

Same procedure: move `parseXboxDate`, `calculateCompletionPercent`,
`uniqueValues`, `mapPlatform`, `pickTitleHubImage`, `mergeXboxTitles`, plus
the `XboxTitleHistoryItem` and `XboxTitleHubItem` type definitions. Imports:
only `import type { SyncedLibraryGame } from "./providers/contracts.ts";`.
Update `xbox.ts` to import from `"@/lib/xbox-library"`; note `xbox.ts` keeps
its own private `isRecord` (used by non-moved code) — only move what the
listed functions need.

**Verify**: `npm run typecheck` → exit 0; `npm run lint` → exit 0.

### Step 4: Characterize the Xbox logic

Create `src/lib/xbox-library.test.ts`. Minimum cases:

1. `calculateCompletionPercent`: progressPercentage 47.6 → 48; achievements
   3/10 (no progressPercentage) → 30; gamerscore 500/1000 (no achievements)
   → 50; all null → null; values clamp to 0–100.
2. `mergeXboxTitles`: a title present in both sources keeps the title-hub
   name/platform/completion/lastPlayed and unions provider ids
   (`titleId:`, `scid:`, `pfn:`); a title only in achievement history still
   appears with `mapPlatform` applied (`"Durango"` passes through,
   `"Win32"`-style values map to `"Xbox / Windows"` — confirm against the
   code); entries without `titleId` or `name` are skipped.
3. `parseXboxDate`: valid ISO string → Date; `"0001-01-01T00:00:00Z"`-style
   sentinel → whatever the code returns today (characterize); non-string →
   null.

**Verify**: `npm test` → all pass.

### Step 5: Extend platform-sync-policy tests

Append to `src/lib/platform-sync-policy.test.ts` (match its existing style):

1. `classifyPlatformSyncError` code mapping — one assertion per code:
   timeout message → `TIMEOUT`; `"HTTP 429 rate limit"` → `RATE_LIMIT`;
   `"STEAM_API_KEY is required to sync owned games from Steam."` →
   `CONFIGURATION`; `"Could not fetch Steam profile (401)."` → `AUTH`;
   `"fetch failed"` → `NETWORK`; `"Could not fetch owned games from Steam (503)."`
   → `PROVIDER`; `"something odd"` → `INTERNAL`.
2. `retryAfterMs` extraction: error object with `retryAfter: "120"` → 120000;
   message containing `"retry-after: 30 seconds"` → 30000; none → null.
3. `sanitizePlatformSyncError`: a message containing
   `"?api_key=SHOULD_NOT_APPEAR"` and a URL → output contains `[redacted]`
   and `[url]` and neither original token; output capped at 280 chars.

Use obviously fake token values in fixtures (e.g. `SHOULD_NOT_APPEAR`) —
never realistic-looking secrets.

**Verify**: `npm test` → all pass; `npm run lint` → exit 0;
`npm run typecheck` → exit 0.

## Test plan

Covered by Steps 2, 4, 5 — ~20 new assertions across three test files, all
characterization (current behavior, including the PSN playtime-null quirk,
which must be flagged in the executor report, not fixed).

## Done criteria

ALL must hold:

- [ ] `npm run lint` exits 0
- [ ] `npm run typecheck` exits 0
- [ ] `npm test` exits 0; `playstation-library.test.ts` and
      `xbox-library.test.ts` exist and run; `platform-sync-policy.test.ts`
      covers all 8 error codes' classification
- [ ] `grep -n "mergePlayStationSyncedGames" src/lib/playstation.ts` shows only an import (function body moved)
- [ ] `grep -n "mergeXboxTitles" src/lib/xbox.ts` shows only an import
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `src/lib/utils.ts` or `src/lib/providers/contracts.ts` turn out to have
  `@/`-aliased or runtime-heavy imports that break `npm test` module loading.
- The structural `PlayStationPlayedGame` type is not assignment-compatible
  with `psn-api`'s actual return type (typecheck error in
  `playstation.ts` after the extraction).
- Any extraction requires changing a function body (beyond the import
  paths) to compile — pure moves only.
- A characterization test reveals behavior so surprising you suspect a bug
  with data-loss impact: write the test pinning current behavior, then STOP
  and report the observation instead of fixing it.

## Maintenance notes

- These tests are the safety net for plan 023 and for the future
  "sync loop latency" refactor — run `npm test` before and after any change
  to the merge logic.
- The PSN playtime-null overwrite quirk (Step 2, case 4) is a candidate
  future fix; it now has a pinned test to flip when someone decides.
- Reviewer should scrutinize: the moved function bodies are byte-identical
  (`git diff` should show pure moves), and the tests assert real values, not
  tautologies.
