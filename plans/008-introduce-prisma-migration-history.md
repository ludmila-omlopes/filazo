# Plan 008: Introduce Prisma Migration History

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan in
> `plans/README.md` unless a reviewer told you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 80086a6..HEAD -- prisma scripts/init-db.mjs package.json README.md .env.example`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: migration
- **Planned at**: commit `80086a6`, 2026-07-03
- **Issue**: https://github.com/ludmila-omlopes/filazo/issues/100

## Why this matters

The project uses PostgreSQL but currently applies schema changes with
`prisma db push`. That bypasses migration history, making production schema
review, rollback planning, and constraint rollout harder. A migration baseline
is also a prerequisite for safely adding new constraints such as
`playingNextSlot` uniqueness.

## Current state

- `prisma/schema.prisma` is the only Prisma schema artifact.
- There is no `prisma/migrations/` directory.
- `scripts/init-db.mjs` validates `DATABASE_URL` and runs `prisma db push`.

Current bootstrap:

```js
// scripts/init-db.mjs:22-27
const result = spawnSync("npx", ["prisma", "db", "push", "--skip-generate"], {
  cwd: process.cwd(),
  env: process.env,
  shell: process.platform === "win32",
  stdio: "inherit",
});
```

Repo conventions to match:

- Local development and production use PostgreSQL.
- `DATABASE_URL` must not be a `file:` SQLite URL.
- If setup flow changes, update `README.md`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Generate baseline SQL | `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` | prints SQL for current schema |
| Prisma validate | `npx prisma validate` | exit 0 |
| Lint | `npm run lint` | exit 0; existing `next/image` warnings may remain |
| Typecheck | `npm run typecheck` | exit 0 |
| Tests | `npm test` | exit 0 |

## Scope

**In scope**:

- `prisma/migrations/**` (create)
- `scripts/init-db.mjs`
- `package.json` if script names or descriptions need adjustment
- `README.md`
- `.env.example` only if setup instructions need an env note

**Out of scope**:

- Changing application data models beyond creating the baseline migration
- Adding the `playingNextSlot` constraint; that is Plan 009
- Running destructive database resets
- Editing local `.env` or committing local database files

## Git workflow

- Branch: `codex/008-prisma-migration-history`
- Commit message style: imperative, matching recent history such as
  `Add migration script and funding config`
- Do not push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create an initial migration from the current schema

Create `prisma/migrations/<timestamp>_initial/migration.sql`, where
`<timestamp>` follows Prisma's timestamp folder style, for example
`20260703120000_initial`.

Generate the SQL from the current schema:

```powershell
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
```

Write the output to the migration file. Do not hand-write table definitions if
the command succeeds.

**Verify**: `Test-Path prisma/migrations/*_initial/migration.sql` -> `True`.

### Step 2: Switch bootstrap from `db push` to migration deploy

Update `scripts/init-db.mjs` so it still:

- loads `.env` when `DATABASE_URL` is not already set;
- rejects missing `DATABASE_URL`;
- rejects `file:` URLs;
- uses `spawnSync` with `shell: process.platform === "win32"` and
  `stdio: "inherit"`.

Change the Prisma command to apply migrations, for example:

```js
spawnSync("npx", ["prisma", "migrate", "deploy"], { ... });
```

If you keep a separate `db:push` script, rename or document it so production
setup does not imply `db push` is the normal path.

**Verify**:
`rg -n "db push|migrate deploy|prisma.*migrate" scripts/init-db.mjs package.json README.md`
-> `scripts/init-db.mjs` uses migrate deploy and README no longer presents
`db push` as the production setup path.

### Step 3: Update docs

Update README setup and database notes:

- explain that migrations live under `prisma/migrations/`;
- `npm run db:init` applies committed migrations;
- future schema changes should create Prisma migrations, not rely on `db push`;
- keep the PostgreSQL-only warning.

Do not remove the existing environment variable documentation.

**Verify**: `rg -n "migrations|migrate deploy|db push|PostgreSQL" README.md scripts/init-db.mjs` -> docs reflect the new flow.

### Step 4: Run verification

Run:

- `npx prisma validate`
- `npm run lint`
- `npm run typecheck`
- `npm test`

Expected: all exit 0. Existing lint warnings for raw `<img>` may remain.

## Test plan

- No new application unit test is required.
- `npx prisma validate` is the schema-level check.
- Existing `tests/prisma-client-sync.test.mjs` and `tests` must still pass.

## Done criteria

- [ ] `prisma/migrations/*_initial/migration.sql` exists and represents the
  current schema.
- [ ] `scripts/init-db.mjs` applies migrations instead of `prisma db push`.
- [ ] README database/setup docs match the migration flow.
- [ ] `npx prisma validate`, `npm run lint`, `npm run typecheck`, and
  `npm test` exit 0.
- [ ] No files outside the in-scope list are modified.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- The target database already has production data and Prisma refuses to apply
  the baseline migration without manual baselining.
- `prisma migrate diff` cannot generate SQL from the current schema.
- The fix appears to require changing models beyond migration metadata.
- A verification command fails twice after a reasonable fix attempt.

## Maintenance notes

Future schema-changing plans should add a migration file in the same PR as the
schema change. Reviewers should verify that no executor silently returns to
`db push` for production setup.
