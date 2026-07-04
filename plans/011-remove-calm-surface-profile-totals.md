# Plan 011: Remove Calm-Surface Profile Totals

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan in
> `plans/README.md` unless a reviewer told you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 80086a6..HEAD -- AGENTS.md src/app/profile/_components/profile-rail.tsx src/lib/i18n.ts tests`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `80086a6`, 2026-07-03
- **Issue**: https://github.com/ludmila-omlopes/filazo/issues/103

## Why this matters

The local product guidance says calm overview surfaces should avoid prominent
library totals and backlog-like numerical summaries. The profile rail is
visible across profile tabs and currently shows owned/wishlist copy plus count
badges for catalog, journal, and assistant. Removing those totals keeps the
profile navigation calmer while leaving focused counts available where they
help complete a task, such as inside the Games tab filters.

## Current state

Product rule:

```md
// AGENTS.md:78-80
Keep the primary catalog interface calm and low-busy...
Avoid prominent counts, totals, and numerical summaries that can make the
library feel like a backlog obligation...
```

Current rail totals:

```tsx
// src/app/profile/_components/profile-rail.tsx:78-80
const gamesCount =
  profile.ownedEntries.length + profile.wishlistEntries.length;
const t = createTranslator(locale);
```

```tsx
// src/app/profile/_components/profile-rail.tsx:107-112
<p className="mt-1 text-xs leading-relaxed text-cream/55">
  {t("profile.rail.ownedCurious", {
    owned: formatNumber(profile.ownedEntries.length, locale),
    wishlist: formatNumber(profile.wishlistEntries.length, locale),
  })}
</p>
```

```tsx
// src/app/profile/_components/profile-rail.tsx:120-166
const count =
  tab === "games" ? gamesCount
  : tab === "journal" ? profile.user.journalEntries.length
  : tab === "assistant" ? assistant?.insights.length ?? null
  : null;
...
{count !== null ? <span>{formatNumber(count, locale)}</span> : null}
```

Repo conventions to match:

- Preserve the existing brutalist/editorial direction.
- Keep source syncing in the Sources tab.
- Use existing translation helpers; do not introduce hard-coded English copy in
  profile UI.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Lint | `npm run lint` | exit 0; existing `next/image` warnings may remain |
| Typecheck | `npm run typecheck` | exit 0 |
| Tests | `npm test` | exit 0 |

## Scope

**In scope**:

- `src/app/profile/_components/profile-rail.tsx`
- `src/lib/i18n.ts` if rail copy keys need replacement
- Tests only if existing profile tests require updates

**Out of scope**:

- Removing focused counts from the Games tab, import audit, or admin settings
- Redesigning navigation
- Changing profile data loading; that is Plan 007
- Removing assistant insight data itself

## Git workflow

- Branch: `codex/011-remove-profile-rail-totals`
- Commit message style: imperative, matching recent history such as
  `Improve player-profile UX and the ongoing-games section`
- Do not push or open a PR unless the operator instructed it.

## Steps

### Step 1: Remove rail count calculations and badges

In `ProfileRail`, remove `gamesCount`, the `count` calculation, the count badge
rendering, and the `formatNumber` import if it becomes unused.

The navigation should still show each tab icon, label, and hint.

**Verify**:
`rg -n "gamesCount|formatNumber|count !== null|journalEntries\\.length|insights\\.length" src/app/profile/_components/profile-rail.tsx`
-> no matches unless a remaining match is not a visible count.

### Step 2: Replace owned/wishlist numerical copy

Replace `profile.rail.ownedCurious` usage with non-numeric copy. Options:

- reuse an existing non-numeric rail hint if one fits; or
- add a new key in `src/lib/i18n.ts`, such as `profile.rail.catalogMood`, in
  both `en` and `pt-BR`.

The copy should describe the shelf without totals. Do not mention backlog size,
owned count, wishlist count, or total catalog count.

**Verify**:
`rg -n "ownedCurious|owned:|wishlist:" src/app/profile/_components/profile-rail.tsx`
-> no matches.

### Step 3: Run verification

**Verify**:

- `npm run lint` -> exit 0; existing `next/image` warning in
  `profile-rail.tsx` may remain unless you choose to fix it in scope.
- `npm run typecheck` -> exit 0.
- `npm test` -> exit 0.

## Test plan

- No new test is required unless existing tests or type checks fail.
- Use lint/typecheck as the primary safety gates.

## Done criteria

- [ ] Profile rail no longer displays owned, wishlist, catalog, journal, or
  assistant counts.
- [ ] Profile rail still renders tab navigation labels and hints.
- [ ] Any new rail copy is localized in both supported locales.
- [ ] Focused task counts outside the rail are left unchanged.
- [ ] `npm run lint`, `npm run typecheck`, and `npm test` exit 0.
- [ ] No files outside the in-scope list are modified.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- Product requirements have changed and the user explicitly wants those rail
  counts retained.
- Removing the counts requires broad profile data-shape changes; defer that to
  Plan 007 instead.
- A verification command fails twice after a reasonable fix attempt.

## Maintenance notes

Counts can still be useful inside focused workflows. Reviewers should reject
new global profile/sidebar totals unless a future product decision explicitly
overrides the local guidance.
