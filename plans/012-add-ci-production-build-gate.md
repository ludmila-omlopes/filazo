# Plan 012: Add CI Production Build Gate

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan in
> `plans/README.md` unless a reviewer told you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 80086a6..HEAD -- .github/workflows/ci.yml package.json README.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `80086a6`, 2026-07-03
- **Issue**: https://github.com/ludmila-omlopes/filazo/issues/104

## Why this matters

CI currently runs lint, type generation/typecheck, and tests, but not
`next build`. Next.js production builds can fail on route, server component,
metadata, environment, or bundling issues that do not appear in lint or
typecheck. Adding the build gate catches release-blocking failures before code
reaches `master`.

## Current state

Build script:

```json
// package.json:8-10
"prebuild": "prisma generate",
"build": "next build",
"start": "next start --hostname localhost --port 3001",
```

CI:

```yaml
# .github/workflows/ci.yml:17-20
- run: npm ci
- run: npm run lint
- run: npm run typecheck
- run: npm test
```

Advisor note from 2026-07-03: `npm run build` did not reach `next build` in the
local Windows workspace because `prisma generate` failed with `EPERM` while
renaming `node_modules/.prisma/client/query_engine-windows.dll.node`. Treat that
as local generated-client file locking unless it reproduces in a clean shell or
on CI.

Repo conventions to match:

- CI uses GitHub Actions on Ubuntu with Node 26 and npm cache.
- README says verification is `npm run lint`, `npm run typecheck`, and
  `npm test`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Lint | `npm run lint` | exit 0; existing `next/image` warnings may remain |
| Typecheck | `npm run typecheck` | exit 0 |
| Tests | `npm test` | exit 0 |
| Build | `npm run build` | exit 0 |

## Scope

**In scope**:

- `.github/workflows/ci.yml`
- `README.md`
- `package.json` only if the build script needs a documented, non-invasive
  adjustment

**Out of scope**:

- Broad source fixes for build failures
- Changing deployment provider
- Changing Node version unless build proves Node 26 is unsupported
- Removing `prisma generate` from `prebuild` without a separate plan

## Git workflow

- Branch: `codex/012-ci-build-gate`
- Commit message style: imperative, matching recent history such as
  `Generate Next route types before typecheck`
- Do not push or open a PR unless the operator instructed it.

## Steps

### Step 1: Run a local build preflight

Run `npm run build` in a clean shell. If it fails with the Windows Prisma
`EPERM` rename error and there are running Node processes from local dev/test
servers, stop those user-owned processes only with operator permission; do not
kill arbitrary processes silently.

If `npm run build` fails with a source-code or Next.js error, stop and report
the exact error. Do not broaden this plan into arbitrary source fixes.

**Verify**: `npm run build` -> exit 0, or STOP condition reached.

### Step 2: Add build to CI

Update `.github/workflows/ci.yml` to run:

```yaml
- run: npm run build
```

Place it after `npm test` or after `npm run typecheck`; either is acceptable.
Keeping it last avoids spending build time when cheaper checks already fail.

**Verify**: `rg -n "npm run build" .github/workflows/ci.yml` -> one CI build step exists.

### Step 3: Update README verification docs

Update README's Verification section to include `npm run build`, and mention
that CI runs the same checks.

**Verify**: `rg -n "npm run build|CI runs" README.md` -> README includes build in verification.

### Step 4: Run full verification

Run:

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

Expected: all exit 0. Existing lint warnings for raw `<img>` may remain.

## Test plan

- No new unit test is required.
- The new CI build step is the regression gate.

## Done criteria

- [ ] CI runs `npm run build`.
- [ ] README verification docs include `npm run build`.
- [ ] Local `npm run build` exits 0, or this plan is stopped with the exact
  non-local-locking build failure documented.
- [ ] `npm run lint`, `npm run typecheck`, and `npm test` exit 0.
- [ ] No files outside the in-scope list are modified.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- `npm run build` fails with a real source-code or Next.js production-build
  error.
- Fixing build requires touching files outside the scope.
- The only failure is the local Prisma generated-client `EPERM` and operator
  approval is needed before stopping processes.
- A verification command fails twice after a reasonable fix attempt.

## Maintenance notes

Once CI runs production builds, future framework or route changes should not be
considered verified until build passes. If build time becomes a problem, tune
CI caching in a separate plan instead of removing the gate.
