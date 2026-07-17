# Plan 019: Surface in-flight PlayStation/Xbox sync state and stop reporting "already syncing" as an error

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6fa54f4..HEAD -- src/app/profile/_components/integrations-panel.tsx src/app/profile/actions.ts src/app/profile/_components/profile-query.ts src/lib/i18n.ts src/components/sync-action-form.tsx`
> This plan was written against branch `feat/feedback-admin-reorg` at commit
> `6fa54f4` **plus uncommitted changes** to `integrations-panel.tsx`,
> `sync-action-form.tsx`, and `src/lib/i18n.ts`. If the excerpts under
> "Current state" do not match your checkout, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `6fa54f4`, 2026-07-17
- **Issue**: https://github.com/ludmila-omlopes/filazo/issues/140

## Why this matters

During beta testing, PlayStation sync "feels stuck in syncing with no UI
feedback". Two concrete defects cause that feeling:

1. Only the **Steam** sync form receives the `externallyPending` prop that
   drives the disabled button, the pending notice, and the 2-second
   `router.refresh()` polling loop. The PlayStation and Xbox forms never get
   it — so while a PS/Xbox sync runs (scheduled, or from another tab), the
   button stays clickable, no notice appears, and the "Syncing" status chip
   goes stale because nothing refreshes the page.
2. Clicking sync while a sync lease is already held redirects with the
   *"Syncing…"* string in the `?error=` query param, so a normal in-progress
   state renders in the error banner.

UX rationale: this is Nielsen's "visibility of system status" — an operation
in progress must present as progress, not as an error, and its completion
must become visible without a manual reload. After this plan, all three
provider forms behave identically to Steam's today, and an "already syncing"
click shows an informational notice instead of an error.

## Current state

- `src/components/sync-action-form.tsx` — client form wrapper. Renders a
  submit button + notice; when `externallyPending` is true it disables the
  button, shows the notice, and polls `router.refresh()` every 2s
  (lines 73–83). No changes needed in this file.
- `src/app/profile/_components/integrations-panel.tsx` — server component
  rendering the three provider rows.
- `src/app/profile/actions.ts` — server actions
  `syncSteamLibraryAction` (~line 1030), `syncPlayStationLibraryAction`
  (~line 1126), `syncXboxLibraryAction` (~line 1163).
- `src/app/profile/_components/profile-query.ts` — `ProfileSearchParams`
  type and `getStatusMessage(locale, query)` which maps query params to the
  banner (`Notice`) on `src/app/profile/page.tsx:174`.
- `src/lib/i18n.ts` — flat dotted string keys inside one object per locale
  (`en` and `pt`); e.g. `"profile.sources.syncing"` exists at ~line 452 (en)
  and ~line 2504 (pt).

Excerpt 1 — `integrations-panel.tsx:539` computes syncing state for Steam
only, and passes it at line 576:

```tsx
  const steamSyncing = isSourceSyncing(profile.steamAccount);
  ...
              <SyncActionForm
                action={syncSteamLibraryAction}
                buttonLabel={t("profile.sources.refreshSteam")}
                externallyPending={steamSyncing}
                pendingLabel={t("profile.sources.refreshing")}
                pendingNotice={t("profile.sources.steamPending")}
              />
```

Excerpt 2 — the PlayStation form (`integrations-panel.tsx:624-631`) and Xbox
form (`integrations-panel.tsx:668-674`) lack the prop:

```tsx
            profile.playStationAccount ? (
              <SyncActionForm
                action={syncPlayStationLibraryAction}
                buttonLabel={t("profile.sources.refreshPlayStation")}
                pendingLabel={t("profile.sources.refreshing")}
                pendingNotice={t("profile.sources.playstationPending")}
              />
            ) : null
```

`isSourceSyncing` already exists at `integrations-panel.tsx:42-47` and works
for any account:

```tsx
function isSourceSyncing(account: ProviderAccount) {
  return Boolean(
    account?.syncLeaseExpiresAt &&
      account.syncLeaseExpiresAt.getTime() > Date.now(),
  );
}
```

Excerpt 3 — the misreported skip, identical shape in all three sync actions
(`actions.ts:1147-1155` shown for PlayStation):

```ts
  if (result.kind !== "succeeded") {
    const message =
      result.kind === "skipped" && result.reason !== "not-connected"
        ? t("profile.sources.syncing")
        : t("profileAction.playStationSyncFailed");
    redirect(
      `/profile?tab=integrations&error=${encodeURIComponent(message)}`,
    );
  }
```

`result` is `Awaited<ReturnType<typeof runManualPlatformSync>>`; the skipped
reasons are `"locked" | "not-connected"` (see `SyncResult` in
`src/lib/platform-sync.ts:31-34`).

Excerpt 4 — `getStatusMessage` in `profile-query.ts` starts with:

```ts
  if (query.error) {
    return { tone: "error", message: query.error };
  }
```

`StatusMessage` is defined in
`src/app/profile/_components/profile-types.ts` — check its `tone` union; the
`Notice` component (`@/components/ui/notice`) already supports an `info`
tone (used at `src/app/profile/page.tsx:161`).

## Commands you will need

| Purpose   | Command             | Expected on success |
|-----------|---------------------|---------------------|
| Install   | `npm install`       | exit 0              |
| Lint      | `npm run lint`      | exit 0              |
| Typecheck | `npm run typecheck` | exit 0, no errors   |
| Tests     | `npm test`          | all pass            |

## Scope

**In scope** (the only files you should modify):
- `src/app/profile/_components/integrations-panel.tsx`
- `src/app/profile/actions.ts` (only the three sync actions' skip handling)
- `src/app/profile/_components/profile-query.ts`
- `src/app/profile/_components/profile-types.ts` (only if the `StatusMessage`
  tone union needs `"info"` added)
- `src/lib/i18n.ts` (add one key to each locale)

**Out of scope** (do NOT touch):
- `src/components/sync-action-form.tsx` — already correct.
- `src/lib/platform-sync.ts` / lease logic — the ~6-minute zombie-lease
  window after a crashed process is a separate concern (see Maintenance
  notes).
- Any other query-param branch in `getStatusMessage`.

## Git workflow

- Branch: `advisor/019-surface-ps-xbox-sync-state`.
- Commit message style: short imperative sentence, e.g.
  `Surface in-flight PlayStation and Xbox sync state`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Pass `externallyPending` to the PlayStation and Xbox forms

In `integrations-panel.tsx`, next to the existing `steamSyncing` at line 539,
add:

```tsx
  const playStationSyncing = isSourceSyncing(profile.playStationAccount);
  const xboxSyncing = isSourceSyncing(profile.xboxAccount);
```

Then add `externallyPending={playStationSyncing}` to the PlayStation
`SyncActionForm` (lines 624-631) and `externallyPending={xboxSyncing}` to the
Xbox `SyncActionForm` (lines 668-674), mirroring the Steam form exactly.

**Verify**: `npm run typecheck` → exit 0, and
`grep -c "externallyPending=" src/app/profile/_components/integrations-panel.tsx`
→ `3`.

### Step 2: Add the i18n key

In `src/lib/i18n.ts`, locate the `statusMessage.` key block in each locale
(`grep -n "statusMessage.steamRefreshed" src/lib/i18n.ts` gives one line per
locale). Add to the **en** object:

```ts
    "statusMessage.syncAlreadyRunning":
      "This library is already syncing. Progress will appear here when it finishes.",
```

and to the **pt** object:

```ts
    "statusMessage.syncAlreadyRunning":
      "Esta biblioteca já está sincronizando. O progresso aparece aqui quando terminar.",
```

**Verify**: `grep -c "statusMessage.syncAlreadyRunning" src/lib/i18n.ts` → `2`.

### Step 3: Redirect "locked" skips to a non-error param

In each of the three sync actions in `actions.ts`
(`syncSteamLibraryAction`, `syncPlayStationLibraryAction`,
`syncXboxLibraryAction`), replace the skip-handling block (Excerpt 3 shape)
with:

```ts
  if (result.kind !== "succeeded") {
    if (result.kind === "skipped" && result.reason === "locked") {
      redirect(`/profile?tab=integrations&syncPending=1`);
    }
    redirect(
      `/profile?tab=integrations&error=${encodeURIComponent(t("profileAction.steamSyncFailed"))}`,
    );
  }
```

Keep each action's own failure translation key exactly as it is today
(`profileAction.steamSyncFailed` / `profileAction.playStationSyncFailed` /
`profileAction.xboxSyncFailed`) — only the locked branch changes.

**Verify**: `grep -c "syncPending=1" src/app/profile/actions.ts` → `3`, and
`grep -n "profile.sources.syncing" src/app/profile/actions.ts` → no matches.

### Step 4: Render the new param as an info notice

In `profile-query.ts`:

1. Add `syncPending?: string;` to the `ProfileSearchParams` type.
2. In `getStatusMessage`, insert **after** the `query.error` branch:

```ts
  if (query.syncPending) {
    return {
      tone: "info",
      message: t("statusMessage.syncAlreadyRunning"),
    };
  }
```

3. Open `profile-types.ts` and check the `StatusMessage` tone union. If it is
   `"error" | "success"`, extend it to `"error" | "success" | "info"`. Then
   confirm the `Notice` component accepts `tone="info"` (it is already used
   with `tone="info"` at `src/app/profile/page.tsx:161`).

**Verify**: `npm run typecheck` → exit 0.

### Step 5: Full verification

**Verify**: `npm run lint` → exit 0; `npm test` → all pass (no new tests in
this plan; this confirms nothing broke).

## Test plan

No unit tests — this plan touches server components, server actions, and an
i18n table, none of which are loadable by the repo's node-test harness (they
import via the `@/` alias and `next/*`). Verification is through typecheck,
lint, and the greps above. If the operator asks for runtime proof, the manual
check is: with a PS account connected, trigger a sync in one tab, open the
profile Sources tab in another — the PlayStation button must show
"Refreshing…" disabled with the pending notice, and recover on its own within
~2s of the sync finishing.

## Done criteria

ALL must hold:

- [ ] `npm run lint` exits 0
- [ ] `npm run typecheck` exits 0
- [ ] `npm test` exits 0
- [ ] `grep -c "externallyPending=" src/app/profile/_components/integrations-panel.tsx` prints `3`
- [ ] `grep -c "syncPending=1" src/app/profile/actions.ts` prints `3`
- [ ] `grep -c "statusMessage.syncAlreadyRunning" src/lib/i18n.ts` prints `2`
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The skip-handling blocks in the three sync actions don't match the Excerpt 3
  shape (e.g. a `cooldown` reason still exists — that means the uncommitted
  cooldown-removal work this plan assumes was reverted).
- `StatusMessage`'s tone union is used in a switch/record somewhere that
  fails typecheck when `"info"` is added and the fix isn't a one-line
  addition.
- `isSourceSyncing` no longer exists in `integrations-panel.tsx`.

## Maintenance notes

- Deferred, related: after a crashed serverless function, the lease keeps
  `isSourceSyncing` true for `accountTimeoutMs + 5min` (~6 minutes) with no
  run actually in progress. If users report multi-minute stuck chips even
  after this plan, the follow-up is a lease-health check (compare
  `syncLeaseExpiresAt` against the newest `PlatformSyncRun` for the account).
- The deeper cause of PS syncs being slow enough to notice is plans 021
  (negative enrichment caching) and the "sync loop latency architecture" item
  in `plans/README.md`.
- Reviewer should scrutinize: the locked-branch `redirect` happens *before*
  the error `redirect` (Next.js `redirect` throws, so order matters), and
  that each action kept its own provider-specific failure message.
