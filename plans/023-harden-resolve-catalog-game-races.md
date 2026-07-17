# Plan 023: Recover from unique-constraint races in resolveCatalogGame instead of failing or duplicating games

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6fa54f4..HEAD -- src/lib/catalog.ts`
> This plan was written against branch `feat/feedback-admin-reorg` at commit
> `6fa54f4` **plus uncommitted changes** to `src/lib/catalog.ts`. Plans 018
> and 021 also edit this file — this plan assumes they landed first; the
> excerpts below are from before those plans, so verify the *structures*
> match even if surrounding lines shifted. On a structural mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (canonical resolution path — recovery-only design, no change to match priority)
- **Depends on**: plans/021-cache-negative-enrichment-lookups.md (ordering only — both edit `resolveCatalogGame`; land 021 first to avoid conflicts). Soft: plans/022 provides the test baseline.
- **Category**: bug
- **Planned at**: commit `6fa54f4`, 2026-07-17
- **Issue**: https://github.com/ludmila-omlopes/filazo/issues/144

## Why this matters

`resolveCatalogGame` looks a game up (provider link → normalized title →
IGDB id) and creates it when nothing matches. Lookup-then-create is not
atomic, and the scheduler runs up to 2 provider syncs concurrently — plus
imports and manual syncs from other users. When two resolutions race on the
same new title:

- If IGDB metadata was found, the second `prisma.game.create` violates the
  `igdbId @unique` constraint and **throws P2002** — that game's sync/import
  row fails for no user-visible reason.
- If no IGDB metadata was found, both creates succeed and produce
  **duplicate canonical Game rows** — violating the repo's core rule
  ("avoid creating duplicate game rows when the same game can be matched by
  provider ID, IGDB ID, or normalized title").

The same race exists on the `GameProviderLink` upserts: Prisma's `upsert` is
not atomic against a concurrent insert of the same unique key and can throw
P2002. The fix is standard: catch P2002, re-run the lookup (or retry the
upsert once), and continue with the row the concurrent writer created.

## Current state

- `src/lib/catalog.ts` — `resolveCatalogGame` spans lines 345-510 (pre-021
  numbering). It imports Prisma **types only**:
  `import { ..., type Prisma, ... } from "@prisma/client"` (line 1-9); a
  runtime `Prisma` import is needed for `instanceof` checks.
- The repo already has an exemplar P2002 check —
  `src/lib/platform-sync.ts:552-556`:

```ts
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2002"
      ) {
        throw error;
      }
```

  (`platform-sync.ts` imports `Prisma` as a value: line 6.)

Excerpt 1 — the unguarded create (`catalog.ts:431-435`):

```ts
  if (!game) {
    game = await prisma.game.create({
      data: metadataToGameCreateInput(canonicalTitle, metadata),
    });
  }
```

Preceding it, the lookups this plan will reuse for recovery:
provider-link lookup (354-370), title lookup (372-378):

```ts
  if (!game) {
    game = await prisma.game.findFirst({
      where: {
        normalizedName: normalizedTitle,
      },
    });
  }
```

and the IGDB lookup (390-397):

```ts
  if (metadata?.igdbId) {
    const gameByIgdb = await prisma.game.findUnique({
      where: {
        igdbId: metadata.igdbId,
      },
    });
    game = gameByIgdb ?? game;
  }
```

Excerpt 2 — the two provider-link upserts that can race: the input-provider
upsert (`catalog.ts:463-484`) and the IGDB link upsert (491-507); both have
the shape:

```ts
    await prisma.gameProviderLink.upsert({
      where: {
        provider_providerGameId: { provider: ..., providerGameId: ... },
      },
      update: { gameId: game.id, ... },
      create: { gameId: game.id, provider: ..., providerGameId: ..., ... },
    });
```

There are additional `gameProviderLink.upsert` calls elsewhere in the sync
executors (e.g. the PSN/Xbox alias-id loops around lines 771-792 and
892-913) — those are OUT of scope here; only the two inside
`resolveCatalogGame` change.

Test conventions: pure helpers in `src/lib/` modules without `@/` imports,
colocated `*.test.ts`, `node:test` + `node:assert/strict`, relative imports
with `.ts` extension. `@prisma/client` resolves from `node_modules` (no
alias), but requires a generated client — `npm install` runs
`prisma generate` via postinstall.

## Commands you will need

| Purpose   | Command             | Expected on success |
|-----------|---------------------|---------------------|
| Install   | `npm install`       | exit 0              |
| Lint      | `npm run lint`      | exit 0              |
| Typecheck | `npm run typecheck` | exit 0, no errors   |
| Tests     | `npm test`          | all pass            |

## Scope

**In scope** (the only files you should modify/create):
- `src/lib/database-errors.ts` (extend — see Step 1; **read it first**, it
  already exists and may already export a unique-violation helper)
- `src/lib/database-errors.test.ts` (create or extend)
- `src/lib/catalog.ts` (only `resolveCatalogGame`: the game create and the
  two provider-link upserts)

**Out of scope** (do NOT touch):
- The lookup order / match priority (provider ID → IGDB ID → normalized
  title) — recovery must reuse it, not alter it.
- Provider-link upserts outside `resolveCatalogGame`.
- Any schema change (a partial unique index on `normalizedName` was
  considered and rejected: distinct games can legitimately share a
  normalized title).
- `applySyncedProgressToRelatedEntries`, `UserGameEntry` upserts.

## Git workflow

- Branch: `advisor/023-harden-resolve-catalog-game-races`.
- Commit message style: short imperative sentence, e.g.
  `Recover from unique-constraint races in catalog resolution`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: A shared unique-violation predicate

Open `src/lib/database-errors.ts`. As of planning it contains exactly one
export, `getDatabaseErrorMessage` (37 lines, no imports). If it has since
gained a P2002/unique-violation helper, use that and skip to Step 2.
Otherwise add:

```ts
import { Prisma } from "@prisma/client";

export function isUniqueConstraintViolation(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}
```

(Match the file's existing style — read it fully first.)

Add tests in `src/lib/database-errors.test.ts` (create if absent; if the
file's existing imports make it un-runnable under `npm test`, STOP and
report):

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { Prisma } from "@prisma/client";
import { isUniqueConstraintViolation } from "./database-errors.ts";

test("detects a P2002 known request error", () => {
  const error = new Prisma.PrismaClientKnownRequestError("Unique failed", {
    code: "P2002",
    clientVersion: "0.0.0",
  });
  assert.equal(isUniqueConstraintViolation(error), true);
});

test("rejects other errors", () => {
  assert.equal(isUniqueConstraintViolation(new Error("P2002")), false);
  const error = new Prisma.PrismaClientKnownRequestError("Not found", {
    code: "P2025",
    clientVersion: "0.0.0",
  });
  assert.equal(isUniqueConstraintViolation(error), false);
});
```

**Verify**: `npm test` → all pass including the new tests. (If importing
`@prisma/client` fails in the test runner, STOP — report the loader error.)

### Step 2: Guard the game create

In `resolveCatalogGame`, replace Excerpt 1 with:

```ts
  if (!game) {
    try {
      game = await prisma.game.create({
        data: metadataToGameCreateInput(canonicalTitle, metadata),
      });
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) throw error;
      // A concurrent resolution created this game first; adopt its row,
      // preferring the same match priority as the lookups above.
      game =
        (metadata?.igdbId
          ? await prisma.game.findUnique({
              where: { igdbId: metadata.igdbId },
            })
          : null) ??
        (await prisma.game.findFirst({
          where: { normalizedName: normalizedTitle },
        }));
      if (!game) throw error;
    }
  }
```

Import `isUniqueConstraintViolation` from `@/lib/database-errors`.

**Verify**: `npm run typecheck` → exit 0.

### Step 3: Guard the two provider-link upserts

Wrap each of the two `gameProviderLink.upsert` calls inside
`resolveCatalogGame` (Excerpt 2 locations) with a single retry:

```ts
    try {
      await prisma.gameProviderLink.upsert({ ...unchanged args... });
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) throw error;
      // Lost a race with a concurrent identical upsert; the row now exists,
      // so retrying takes the update path.
      await prisma.gameProviderLink.upsert({ ...unchanged args... });
    }
```

To avoid duplicating the argument objects, extract each call's args into a
local `const` first, or extract a tiny local helper
`upsertProviderLinkWithRetry(args)` inside the module — either is fine;
keep the arguments byte-identical to today's.

**Verify**: `npm run lint` → exit 0; `npm run typecheck` → exit 0;
`npm test` → all pass.

## Test plan

- Unit tests for `isUniqueConstraintViolation` (Step 1): true on P2002,
  false on plain Error and on other Prisma codes.
- The race itself is not reproducible under the repo's node-test harness
  (no DB, no way to load `catalog.ts` with its aliased imports) — the
  behavioral protection is the recovery code plus these predicate tests.
  State this limitation in the executor report.
- Verification: `npm test` → all pass.

## Done criteria

ALL must hold:

- [ ] `npm run lint` exits 0
- [ ] `npm run typecheck` exits 0
- [ ] `npm test` exits 0 and includes the `database-errors` tests
- [ ] `grep -n "isUniqueConstraintViolation" src/lib/catalog.ts` shows ≥ 3 uses (one create guard, two upsert guards)
- [ ] The lookup block at the top of `resolveCatalogGame` (provider link →
      title → IGDB) is unchanged (`git diff` shows no edits there)
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `src/lib/database-errors.ts` already implements conflicting/overlapping
  helpers whose semantics differ from P2002-detection — reconcile by
  reporting, not by refactoring that file.
- `resolveCatalogGame` no longer contains the Excerpt 1/2 structures (plans
  018/021 should not have touched them; if they did, the plan needs a
  refresh).
- Importing `@prisma/client` in a test file fails under `npm test`.
- You find yourself wanting to wrap the whole resolution in a transaction —
  that changes locking behavior across external HTTP calls and is explicitly
  not this plan.

## Maintenance notes

- This makes resolution *convergent* under races but not *serialized*: two
  concurrent no-metadata resolutions can still both pass the recovery lookup
  in a narrow window. Full elimination needs an advisory lock or a
  DB-level normalized-name uniqueness scheme, both rejected for now (cost >
  residual risk). Revisit if duplicate Game rows are observed in production
  after this lands.
- If a future plan batches game creation (the "sync loop latency" backlog
  item), the recovery pattern must move with it.
- Reviewer should scrutinize: the recovery lookup order matches the main
  lookup priority (IGDB id before normalized title), and the upsert retry
  reuses byte-identical arguments.
