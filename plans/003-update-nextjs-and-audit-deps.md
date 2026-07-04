# Plan 003: Patch Next.js to 16.2.x latest and clear high-severity npm audit findings

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 36636b8..HEAD -- package.json package-lock.json`
> If the manifests changed since this plan was written, re-run `npm audit`
> and re-evaluate which of the advisories below still apply before proceeding.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED (framework patch bump — mitigated by build + smoke verification)
- **Depends on**: none
- **Category**: security / dependencies
- **Planned at**: commit `36636b8`, 2026-07-01
- **Issue**: https://github.com/ludmila-omlopes/filazo/issues/91

## Why this matters

`npm audit` on this repo (run 2026-07-01) reports 10 vulnerabilities (6 high). The one that matters most: **`next@16.2.1` carries 14 published advisories**, including middleware/proxy authorization bypasses (GHSA-267c-6grr-h53f, GHSA-26hh-7cqf-hhc6, GHSA-492v-c6pp-mqqv), cache poisoning of RSC responses (GHSA-wfc6-r584-vfw7, GHSA-vfv6-92ff-j949, GHSA-3g8h-86w9-wvmq), XSS variants, SSRF via WebSocket upgrades, and several DoS vectors. The fix is `next@16.2.10` — a **patch-line** bump within the already-pinned major/minor. Also high: `defu <= 6.1.4` prototype pollution and `effect < 3.20.0` (transitive via `prisma`). This is the cheapest high-impact security change available to this app, which is publicly deployed with authentication.

## Current state

- `package.json:29` — `"next": "16.2.1"` (exact pin, no `^`).
- `package.json:50` — `"eslint-config-next": "16.2.1"`.
- `package.json:22,31` — `"@prisma/client": "^6.19.0"`, `"prisma": "^6.19.0"` (the `effect` advisory is transitive via `@prisma/config`; `npm audit` says fixed in prisma ≥ 6.19.3 within the `^6` range).
- `defu` and `postcss` advisories are transitive; `npm audit fix` (non-force) should cover them.
- This is a Next.js 16 **App Router** project. Per repo rules (AGENTS.md), before assuming any Next.js API behavior read the local docs under `node_modules/next/dist/docs/` — but this plan changes no application code; if the patch bump surfaces a behavioral change, that's a STOP condition, not something to code around.
- There are no tests and no CI (as of the planned-at commit; plan 004 adds them). Verification is typecheck + lint + production build + dev-server smoke test.
- `npm run build` runs `prisma generate` first (prebuild script) — it needs no database connection. `next build` may prerender pages; if a page needs `DATABASE_URL` at build time, the build error will say so (see STOP conditions).

## Commands you will need

| Purpose   | Command                          | Expected on success |
|-----------|----------------------------------|---------------------|
| Install   | `npm install`                    | exit 0              |
| Audit     | `npm audit`                      | see step targets    |
| Typecheck | `npx tsc --noEmit`               | exit 0              |
| Lint      | `npm run lint`                   | exit 0 (3 pre-existing `no-img-element` warnings OK) |
| Build     | `npm run build`                  | exit 0, "Compiled successfully" |
| Dev smoke | `npm run dev` then GET http://localhost:3001 | HTTP 200 on `/` |

## Scope

**In scope** (the only files you should modify):
- `package.json`
- `package-lock.json`
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- Any `src/` file. If the bump requires source changes, STOP and report.
- `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`.
- Major-version upgrades of anything (`react`, `tailwindcss`, `zod`, `prisma` to 7.x, etc.).
- `npm audit fix --force` — never; it jumps package majors.

## Git workflow

- Branch: `advisor/003-update-nextjs-and-audit-deps`
- One commit, e.g. "Update Next.js to 16.2.10 and apply npm audit fixes"
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Bump Next.js and its ESLint config

```
npm install next@16.2.10 eslint-config-next@16.2.10 --save-exact
```

If 16.2.10 is unavailable, use the highest `16.2.x`; do NOT cross into 16.3+.

**Verify**: `node -e "console.log(require('next/package.json').version)"` → `16.2.10` (or the chosen 16.2.x)

### Step 2: Apply remaining non-breaking audit fixes

```
npm audit fix
```

(no `--force`). Then update prisma within its semver range if the `effect` advisory persists: `npm install prisma@^6.19.3 @prisma/client@^6.19.3` (stay on `^6`).

**Verify**: `npm audit` → 0 high-severity findings in **production** dependencies (`npm audit --omit=dev`); dev-only moderate/low leftovers are acceptable — record them in your report.

### Step 3: Full verification

Run in order:

1. `npx tsc --noEmit` → exit 0
2. `npm run lint` → exit 0
3. `npm run build` → exit 0
4. Smoke test: start `npm run dev`, wait for ready, then `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/` → `200`. Also fetch `/login` → `200`. Stop the dev server afterwards.

**Verify**: all four above.

## Test plan

No new tests — this plan changes no first-party code. The verification gates above are the test.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `next` resolved version is 16.2.10 (or highest 16.2.x, documented)
- [ ] `npm audit --omit=dev` reports 0 high-severity vulnerabilities
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm run build` exits 0
- [ ] `/` and `/login` return HTTP 200 from a dev server
- [ ] `git status` shows only `package.json`, `package-lock.json`, `plans/README.md` modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `npm run build` or `npx tsc --noEmit` fails after the bump with errors in `src/` — the patch changed framework behavior; report the exact errors instead of editing source.
- `npm audit fix` wants to change `react`, `react-dom`, or any package's **major** version.
- The build demands `DATABASE_URL` or other env at build time that isn't available — report; do not fabricate env values beyond what `.env` already provides.
- `next@16.2.10` does not exist and no 16.2.x above 16.2.1 is published.

## Maintenance notes

- Next.js security patches land on the patch line; a monthly `npm audit` (or Dependabot/Renovate, deliberately out of scope here) would keep this from drifting again.
- The `effect`/`@prisma/config` advisory is dev-tooling-adjacent (Prisma CLI); it matters less than the Next.js advisories but is free to fix within `^6`.
- Reviewer should scrutinize: the lockfile diff contains only expected subtrees (next, eslint-config-next, prisma, defu, postcss and their deps).
