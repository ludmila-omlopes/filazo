# Plan 004: Establish a verification baseline — typecheck script, first unit tests, GitHub Actions CI

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 36636b8..HEAD -- package.json src/lib/utils.ts src/lib/time-estimates.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none (plans 001 and 002 add their own test files that this CI will then run — order is flexible)
- **Category**: tests / dx
- **Planned at**: commit `36636b8`, 2026-07-01
- **Issue**: https://github.com/ludmila-omlopes/filazo/issues/92

## Why this matters

This ~27K-line production app has **zero tests and zero CI**. `package.json` has a `test` script (`node --experimental-strip-types --test`) with nothing to run, no `typecheck` script, and `.github/` contains only `FUNDING.yml`. Every refactor — including the sync-performance work in plan 005, which this plan should precede — currently ships unverified. This plan creates the smallest useful baseline: a `typecheck` script, unit tests for two pure business-logic modules (title normalization, which the canonical game-matching rule depends on, and remaining-time estimation), and a CI workflow that runs lint + typecheck + tests on every push/PR.

## Current state

- `package.json:5-16` scripts (verbatim):

```json
"dev": "next dev --hostname localhost --port 3001",
"postinstall": "prisma generate",
"prebuild": "prisma generate",
"build": "next build",
"start": "next start --hostname localhost --port 3001",
"lint": "eslint",
"test": "node --experimental-strip-types --test",
"db:generate": "prisma generate",
"db:init": "node scripts/init-db.mjs",
"db:push": "node scripts/init-db.mjs"
```

- Node v26 in dev; `--experimental-strip-types` is accepted (stripping is default-on in v26 but the flag is harmless). Node's runner auto-discovers `**/*.test.ts`.
- `npx tsc --noEmit` currently exits 0; `npm run lint` exits 0 with 3 pre-existing `no-img-element` warnings.
- Test target 1 — `src/lib/utils.ts` (pure string/format helpers). Key excerpt:

```ts
// src/lib/utils.ts:12-33
export function cleanGameTitle(value: string) {
  return value
    .replace(/[™®©]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeTitle(value: string) {
  return cleanGameTitle(value)
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function slugify(value: string) { /* normalizeTitle → dashes */ }
```

  `normalizeTitle` feeds `Game.normalizedName`, the canonical duplicate-prevention key (AGENTS.md architecture rule). Also in the file: `uniqueSlug`, `formatPlaytime`, `formatTimeEstimate`, `formatRemainingTime`, `formatCompletionPercent`, `formatLastPlayed`, `formatDate`, `formatNumber`.

- Test target 2 — `src/lib/time-estimates.ts` (fully pure; exports `isEntryFinished` and `estimateRemainingTime`). Behavior contract: target preference order is mainExtra → mainStory → completionist (`getDefaultTarget`, lines 41-67); finished entries return `remainingMinutes: 0, basis: "completed"`; `completionPercent` (including `0`) takes precedence over playtime; playtime > 0 subtracts from target with a floor of 0; otherwise `basis: "full-estimate"`. It imports `UserGameStatus` from `@prisma/client`, so `prisma generate` must have run (the `postinstall` hook does this).

- CI facts: PostgreSQL is NOT needed for lint/typecheck/tests (none of the target modules touch the DB at runtime; `@prisma/client` enum imports only need the generated client). `npm ci` triggers `postinstall` → `prisma generate`, which needs only `prisma/schema.prisma`, no live database.

## Commands you will need

| Purpose   | Command             | Expected on success |
|-----------|---------------------|---------------------|
| Install   | `npm install`       | exit 0              |
| Typecheck | `npx tsc --noEmit` (later `npm run typecheck`) | exit 0 |
| Lint      | `npm run lint`      | exit 0 (3 `no-img-element` warnings OK) |
| Tests     | `npm test`          | exit 0, all tests listed |

## Scope

**In scope** (the only files you should modify):
- `package.json` (add `typecheck` script only — do not touch dependencies)
- `src/lib/utils.test.ts` (create)
- `src/lib/time-estimates.test.ts` (create)
- `.github/workflows/ci.yml` (create)
- `README.md` (add a short "Verification" note: the three commands)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- Any file in `src/` other than the two new `.test.ts` files — if a test reveals a bug in `utils.ts`/`time-estimates.ts`, record it as a failing-expectation note in your report; do NOT change the implementation (characterization first — the current behavior is the spec until a human rules otherwise; write the test to match actual behavior and flag the surprise).
- No new devDependencies (no vitest/jest — Node's built-in runner is the repo's chosen tool).
- `npm run build` in CI — deliberately excluded for now (needs env decisions); lint+typecheck+test only.
- `.github/FUNDING.yml`.

## Git workflow

- Branch: `advisor/004-verification-baseline`
- Commit per step is fine; subjects like "Add typecheck script", "Add unit tests for title normalization and time estimates", "Add CI workflow"
- Do NOT push or open a PR unless the operator instructed it (note: CI proof requires a push — leave that to the operator).

## Steps

### Step 1: Add the typecheck script

In `package.json` scripts, after `"lint"`, add:

```json
"typecheck": "tsc --noEmit",
```

**Verify**: `npm run typecheck` → exit 0

### Step 2: Unit tests for utils.ts

Create `src/lib/utils.test.ts` using Node's built-in runner. Import style (the `@/*` alias does not resolve under `node --test`; use relative + extension):

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanGameTitle, normalizeTitle, slugify, uniqueSlug } from "./utils.ts";
```

Minimum cases (add more if quick):
1. `cleanGameTitle("  The Witcher® 3™  ")` → `"The Witcher 3"`.
2. `normalizeTitle("The Witcher® 3: Wild Hunt")` → `"the witcher 3 wild hunt"`.
3. `normalizeTitle("Pokémon")` → `"pokemon"` (NFKD strips the accent; verify actual output first — if it differs, assert the actual value and note it).
4. Idempotence: `normalizeTitle(normalizeTitle(x)) === normalizeTitle(x)` for a few inputs.
5. `slugify("The Witcher 3: Wild Hunt")` → `"the-witcher-3-wild-hunt"`.
6. `slugify("")` → `""` and `normalizeTitle("™®©")` → `""` (empty/symbol-only inputs).
7. `uniqueSlug("Doom", "ABC1")` → `"doom-abc1"`.

Note for case 3: `\w` in `normalizeTitle`'s regex means non-ASCII letters that DON'T decompose (e.g. Japanese titles) are stripped entirely — if you find e.g. `normalizeTitle("ゼルダの伝説")` returns `""`, assert that actual behavior and flag it in your report notes as a matching-quality observation. Do not "fix" it.

**Verify**: `npm test` → exit 0, utils tests listed and passing. If `npm test` discovers nothing, run `node --experimental-strip-types --test src/lib/utils.test.ts`; if that works but discovery doesn't, change the `test` script to `node --experimental-strip-types --test "src/**/*.test.ts"` and note it.

### Step 3: Unit tests for time-estimates.ts

Create `src/lib/time-estimates.test.ts` (same import style; `UserGameStatus` can be imported from `@prisma/client` — run `npx prisma generate` first if the import fails).

Cases:
1. `isEntryFinished({ status: "COMPLETED" })` → `true`; `isEntryFinished({ status: "PLAYING", finishedAt: new Date() })` → `true`; `isEntryFinished({ status: "PLAYING" })` → `false`.
2. No HLTB data at all → `estimateRemainingTime` returns `null`.
3. Target preference: game with all three HLTB fields uses `mainExtra` (label `"main + extras"`); only `hltbMainStoryMinutes` set → label `"main story"`; only completionist → `"completionist"`.
4. Finished entry → `remainingMinutes: 0`, `basis: "completed"`.
5. `completionPercent: 25`, target 100 minutes → `remainingMinutes: 75`, `basis: "completion-percent"`.
6. `completionPercent: 0` → basis is still `"completion-percent"` (zero is not "missing"), remaining = full target.
7. `completionPercent` null, `playtimeMinutes: 30`, target 100 → `remainingMinutes: 70`, `basis: "playtime"`; playtime 150 → `remainingMinutes: 0`.
8. Neither percent nor playtime → `basis: "full-estimate"`, remaining = target.

**Verify**: `npm test` → exit 0, both test files' cases pass.

### Step 4: CI workflow

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [master]
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 26
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
```

Notes: default branch is `master` (not main). `npm ci` runs `postinstall` → `prisma generate` — no database or env needed.

**Verify** (locally, since you can't push): `npm ci && npm run lint && npm run typecheck && npm test` all exit 0 in sequence — the exact commands CI will run. Also validate YAML parses: `node -e "console.log(require('js-yaml') ? 'skip' : '')"` is unreliable — instead just confirm the file matches the block above.

### Step 5: README verification note

Add a short "## Verification" section to `README.md` (near the existing development instructions): the three commands (`npm run lint`, `npm run typecheck`, `npm test`) and one line saying CI runs them on every push/PR.

**Verify**: `npm run lint` → exit 0

## Test plan

Steps 2-3 ARE the test plan: ~15 assertions across two pure modules chosen because (a) `normalizeTitle` is the canonical-catalog duplicate-prevention key, and (b) `estimateRemainingTime` drives user-visible "time to credits" estimates. These are the first tests in the repo; they set the structural pattern for future test files (Node built-in runner, relative imports with `.ts` extension, one `.test.ts` beside each source module).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run typecheck` exists and exits 0
- [ ] `npm test` exits 0 and reports ≥ 15 passing tests across 2 files
- [ ] `.github/workflows/ci.yml` exists with lint + typecheck + test steps
- [ ] `npm run lint` exits 0
- [ ] No implementation file under `src/` modified (`git status` — only the two new `.test.ts` files)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `node --test` cannot execute `.ts` test files at all (report Node version and exact error).
- Importing `@prisma/client` in a test fails even after `npx prisma generate`.
- A test expectation and actual behavior differ in a way you cannot honestly characterize (i.e., the function looks outright broken, not just surprising) — report the input/actual/expected triple.
- Adding the `typecheck` script or tests somehow breaks `npm run build`-adjacent tooling (it shouldn't — nothing else changes).

## Maintenance notes

- Future plans (especially 005) must add their tests to this harness and keep CI green.
- CI intentionally excludes `npm run build` — adding it later needs a decision about build-time env (`DATABASE_URL` presence). That's a deliberate follow-up, not an oversight.
- The Unicode notes from Step 2 (accented and non-Latin titles) are seed material for a future finding on matching quality in `normalizeTitle` — the characterization tests document today's behavior so any future change to normalization is a visible, reviewed decision (it affects `Game.normalizedName` matching and could merge distinct games or split existing ones).
