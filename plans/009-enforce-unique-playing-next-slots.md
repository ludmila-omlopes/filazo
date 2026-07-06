# Plan 009: Enforce Unique Playing-Next Slots

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan in
> `plans/README.md` unless a reviewer told you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 80086a6..HEAD -- prisma/schema.prisma prisma/migrations src/app/profile/actions.ts tests`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED
- **Depends on**: plans/008-introduce-prisma-migration-history.md
- **Category**: bug
- **Planned at**: commit `80086a6`, 2026-07-03
- **Issue**: https://github.com/ludmila-omlopes/filazo/issues/101

## Why this matters

`currentPlayingSlot` is protected by a database uniqueness constraint, but
`playingNextSlot` is not. The server actions clear and rewrite queue slots in a
transaction, but without a database constraint two concurrent requests can leave
duplicate slot values for one user. This plan adds the missing invariant in the
same canonical `UserGameEntry` model.

## Current state

Relevant schema:

```prisma
// prisma/schema.prisma:215-230
currentPlayingSlot Int?
playingNextSlot   Int?
...
@@unique([userId, gameId, status])
@@unique([userId, currentPlayingSlot])
@@index([userId, status])
```

Relevant queue rewrite:

```ts
// src/app/profile/actions.ts:450-545
await prisma.$transaction(async (tx) => {
  await tx.userGameEntry.updateMany({
    where: { userId, playingNextSlot: { not: null } },
    data: { playingNextSlot: null },
  });
  ...
  await tx.userGameEntry.update({
    where: { id: selection.entryId },
    data: { playingNextSlot: selection.slot, status: UserGameStatus.PLAYING_NEXT },
  });
});
```

Repo conventions to match:

- Treat `UserGameEntry` as per-user state.
- Do not bypass canonical game resolution.
- Schema changes must keep `prisma/schema.prisma`, migration files, and README
  in sync after Plan 008.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Prisma validate | `npx prisma validate` | exit 0 |
| Generate client | `npm run db:generate` | exit 0 |
| Typecheck | `npm run typecheck` | exit 0 |
| Tests | `npm test` | exit 0 |
| Lint | `npm run lint` | exit 0; existing `next/image` warnings may remain |

## Scope

**In scope**:

- `prisma/schema.prisma`
- `prisma/migrations/**` (new migration only)
- `tests/prisma-client-sync.test.mjs`
- `src/app/profile/actions.ts` only if needed to map unique-constraint errors
  to existing user-facing messages

**Out of scope**:

- Changing the number of Playing next slots
- Redesigning Playing next UI
- Changing `currentPlayingSlot`
- Adding application-level locks

## Git workflow

- Branch: `codex/009-unique-playing-next-slots`
- Commit message style: imperative, matching recent history such as
  `Add playing next queue`
- Do not push or open a PR unless the operator instructed it.

## Steps

### Step 1: Confirm Plan 008 is done

Read `plans/README.md`. This plan depends on `008` because it must add a
reviewable migration.

**Verify**: the row for Plan 008 is `DONE`. If it is not, stop.

### Step 2: Add the schema invariant

In `prisma/schema.prisma`, add:

```prisma
@@unique([userId, playingNextSlot])
```

Place it next to `@@unique([userId, currentPlayingSlot])`.

**Verify**: `npx prisma validate` -> exit 0.

### Step 3: Add the migration

Create a Prisma migration that adds the unique index/constraint for
`UserGameEntry(userId, playingNextSlot)`. PostgreSQL allows multiple `NULL`
values in a unique constraint, which is the desired behavior because most
entries are not queued.

Before applying locally, check for duplicates in any reachable development
database if one is configured:

```sql
SELECT "userId", "playingNextSlot", COUNT(*)
FROM "UserGameEntry"
WHERE "playingNextSlot" IS NOT NULL
GROUP BY "userId", "playingNextSlot"
HAVING COUNT(*) > 1;
```

If duplicates exist, stop and report the rows; do not invent a cleanup policy.

**Verify**: migration SQL exists under `prisma/migrations/` and contains a
unique constraint or unique index for `playingNextSlot`.

### Step 4: Update Prisma sync test

Extend `tests/prisma-client-sync.test.mjs` so it verifies the generated Prisma
model metadata includes the new unique index. If the existing test only checks
field presence, add a nearby assertion against Prisma's DMMF/model metadata.

**Verify**: `npm test` -> exit 0.

### Step 5: Run full verification

Run:

- `npm run db:generate`
- `npm run lint`
- `npm run typecheck`
- `npm test`

Expected: all exit 0; existing lint warnings for raw `<img>` may remain.

## Test plan

- Extend the existing Prisma client sync test.
- The test should fail if `playingNextSlot` exists as a field but lacks a unique
  user/slot invariant in generated metadata.

## Done criteria

- [ ] `prisma/schema.prisma` has `@@unique([userId, playingNextSlot])`.
- [ ] A migration adds the corresponding PostgreSQL unique constraint/index.
- [ ] Duplicate existing data is checked before applying the migration; any
  duplicate data caused a STOP instead of silent cleanup.
- [ ] Prisma sync tests cover the new invariant.
- [ ] `npm run db:generate`, `npm run lint`, `npm run typecheck`, and
  `npm test` exit 0.
- [ ] No files outside the in-scope list are modified.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- Plan 008 is not DONE.
- Existing data contains duplicate non-null `playingNextSlot` values.
- Prisma migration generation wants to reset or drop unrelated data.
- A verification command fails twice after a reasonable fix attempt.

## Maintenance notes

Any future slot-like field on `UserGameEntry` should have its database invariant
added at the same time as the application action. Reviewers should check that
the migration only changes the intended constraint.
