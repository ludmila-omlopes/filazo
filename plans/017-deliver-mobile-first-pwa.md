# Plan 017: Deliver a mobile-first installable PWA before funding a native app

> **Executor instructions**: Follow this plan in the three pull-request slices
> described below. Run every verification command and record real-device QA
> evidence before moving on. If a STOP condition occurs, report it instead of
> improvising. Update plan 017 in `plans/README.md` only after the beta-ready
> PWA is complete.
>
> **Drift check (run first)**:
> `git diff --stat 9a5d649..HEAD -- src/app/layout.tsx src/app/globals.css src/components/site-header-frame.tsx src/components/ui/button.tsx src/app/profile/page.tsx src/app/profile/_components/profile-rail.tsx src/app/profile/_components/shelf-grid.tsx src/app/profile/_components/integrations-panel.tsx src/components/voice-memory-input.tsx src/lib/i18n.ts next.config.ts package.json package-lock.json`
>
> This plan was written while the working tree already contained unrelated,
> uncommitted changes, including `src/app/layout.tsx`, `package.json`, and
> `package-lock.json`. Do not execute it until those changes are committed or
> isolated. Refresh this plan if the current-state evidence no longer matches.

## Status

- **Priority**: P1 if mobile is the next milestone; otherwise P2
- **Effort**: L (roughly 3-4 weeks including device QA and beta observation)
- **Risk**: MED (navigation, auth callbacks, uploads, and installed mode)
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `9a5d649` plus the uncommitted tree observed on 2026-07-11
- **Issue**: https://github.com/ludmila-omlopes/filazo/issues/125
- **Implementation issues**:
  - Mobile shell and navigation: https://github.com/ludmila-omlopes/filazo/issues/126
  - Installable online-first PWA: https://github.com/ludmila-omlopes/filazo/issues/127
  - Mobile media, OAuth, and device QA: https://github.com/ludmila-omlopes/filazo/issues/128

## Recommendation

Build one mobile-first web product and make it installable as a PWA. Do not
start an Expo/React Native app or a thin WebView wrapper in this milestone.

The existing application already has the expensive pieces: responsive App
Router pages, cookie sessions, Server Actions, canonical catalog resolution,
provider OAuth callbacks, photo upload, and browser audio recording. Its mobile
gap is mostly information architecture, navigation, touch ergonomics,
installed-mode polish, and device testing. A native client would first require
a versioned HTTP API, native authentication/deep links, a second UI, and store
release operations.

The PWA MVP is deliberately **online-first**. Do not cache authenticated HTML,
catalog data, mutations, uploads, or Server Action responses offline. Add a
service worker only for a bounded later feature such as push notifications;
authenticated routes and mutation traffic must remain network-only.

## Current state

- `package.json` uses Next.js 16, React 19, Prisma, and Server Actions. There is
  no native runtime, PWA package, browser E2E runner, or separate API client.
- `src/app/layout.tsx:149-199` renders a responsive shell but puts all
  navigation, locale/theme controls, identity, and sign-out into one header.
  At `max-sm`, `src/components/site-header-frame.tsx:19-27` turns it into a
  vertical block instead of a compact mobile app bar.
- `src/app/profile/page.tsx:143-152` collapses the profile layout, but
  `src/app/profile/_components/profile-rail.tsx:92-156` then shows the full
  identity card and seven links above active content on every mobile tab.
- `src/app/profile/_components/shelf-grid.tsx:140-198` already has list/grid
  cards and mobile row collapse. Preserve this UI and the canonical catalog.
- `src/components/ui/button.tsx:25-31` gives default/icon controls a 44px
  target, but compact variants are 28-36px and need mobile-only hit-area help.
- `src/app/profile/_components/integrations-panel.tsx:411-419` accepts
  `image/*`, and `src/components/voice-memory-input.tsx:248-318` records through
  `getUserMedia`/`MediaRecorder`. Validate these on phones before rebuilding
  them natively.
- `tests/oauth-browser.test.mjs:24-37` covers regular iOS Safari and Android
  Chrome user agents, but installed standalone OAuth has not been verified.
- `src/app/icon.png` is a 512x512 brand icon and `src/app/apple-icon.png`
  exists. Generate explicit manifest sizes and maskable-safe artwork from the
  approved identity.
- There is no `src/app/manifest.ts`, install affordance, safe-area treatment,
  service worker, or installed-mode test.
- Read these local Next.js 16 guides before implementation:
  `node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md`,
  `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/manifest.md`,
  and `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-viewport.md`.

## Mobile MVP journeys

1. Open the app and see current/queued games.
2. Search/browse the canonical catalog and open a game.
3. Choose something in Tonight and update a status.
4. Add a journal memory with text, photo, or voice.

Provider connection, sync, CSV/photo import, onboarding, and preferences stay
under secondary navigation. Admin is responsive but is not an MVP acceptance
gate. This preserves the rule that Sources owns sync/import flows and keeps the
primary catalog calm.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Install | `npm ci` | exit 0 |
| Tests | `npm test` | all pass |
| Lint | `npm run lint` | exit 0; report pre-existing warnings |
| Typecheck | `npm run typecheck` | exit 0 |
| Build | `npm run build` | exit 0 |
| Manifest | `Invoke-WebRequest http://localhost:3001/manifest.webmanifest \| Select-Object -Expand Content` | valid JSON with identity, scope, display, colors, and icons |

## Scope

**In scope** (narrow per PR; do not expand without review):

- `src/app/manifest.ts` (create)
- `src/app/layout.tsx`
- `src/app/globals.css`
- `src/components/site-header-frame.tsx`
- `src/components/mobile-app-navigation.tsx` (create)
- `src/components/install-app-card.tsx` (create only if needed)
- `src/components/ui/button.tsx`
- `src/app/profile/page.tsx`
- `src/app/profile/_components/profile-rail.tsx`
- `src/app/profile/_components/shelf-grid.tsx`
- `src/app/profile/_components/integrations-panel.tsx`
- `src/app/games/[slug]/_components/game-memory-card.tsx`
- `src/app/tonight/_components/tonight-room.tsx`
- `src/lib/i18n.ts`
- `public/icons/*` (create from the approved icon)
- `next.config.ts` only for a documented required header
- `package.json` / `package-lock.json` only for an agreed browser-test tool
- `tests/mobile-*.test.mjs` and/or `e2e/mobile-*.spec.ts` (create)
- `docs/mobile-qa.md` (create)

**Out of scope**:

- Prisma changes or mobile-specific catalog entities.
- Expo/React Native, Capacitor, or a WebView shell.
- A second catalog resolution path or client copy of `src/lib/catalog.ts`.
- Offline mutation queues, private library caching, or background sync.
- Push in the MVP; define use case and consent before storing subscriptions.
- Moving sync/import out of Sources.
- Redesigning desktop into generic dashboard UI.

## Git workflow

- Branch: `codex/017-mobile-first-pwa`
- Prefer three reviewable slices: mobile shell/navigation, installability, then
  device hardening/QA.
- Match imperative commit style, e.g. `Add mobile app navigation`.
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Establish the device baseline

Record screenshots and pass/fail notes at 360x800, 390x844, 430x932, and small
landscape. Test at least one real iPhone Safari and Android Chrome. Cover header
height, profile navigation, catalog search/filter/status actions, Tonight, game
detail, photo/camera handoff, microphone permission/record/playback/upload,
Google/Steam/Xbox redirects where credentials exist, keyboard-open behavior,
text zoom, and browser-chrome overlap. Store non-sensitive evidence in
`docs/mobile-qa.md`.

**Verify**: `Test-Path docs/mobile-qa.md` returns `True`; it contains every
named viewport/device and all four MVP journeys.

### Step 2: Build compact mobile navigation

Keep desktop header/rail behavior. On narrow screens:

- use a compact top bar for brand plus one overflow/account entry;
- add a fixed bottom bar on signed-in product routes with no more than Home
  (`/profile`), Catalog (`/profile?tab=games`), Tonight (`/tonight`), and Journal
  (`/profile?tab=journal`);
- put Sources, Guide/player profile, setup, language, theme, and sign-out in
  secondary navigation;
- hide the identity card and seven-link rail from the top of mobile profile
  content while keeping all destinations accessible;
- account for `env(safe-area-inset-bottom)` and pad content so the bar never
  covers cards, forms, notices, or the footer;
- preserve server rendering and `Link`; do not invent a client router.

Set `aria-current` from route/search params and add both locale labels. Do not
show the signed-in bar on landing, auth, beta, legal, or admin routes.

**Verify**: `npm run lint`, `npm run typecheck`, and `npm test` exit 0. At 360px
active content begins without the full rail above it, and keyboard/touch users
can reach the same destinations.

### Step 3: Harden touch, density, and media

- Give primary and compact catalog/status controls at least 44x44 CSS hit areas
  on touch layouts while allowing smaller visible glyphs.
- Do not rely on hover for required actions; preserve explicit "Update status"
  progressive disclosure.
- Keep list/grid views, but prevent narrow two-column cards from crushing titles
  or controls. Use one-column action rows where needed.
- Reduce the global 28px panel padding on mobile where it materially helps.
- Add a clear camera-oriented path without removing gallery/file selection or
  forcing camera capture on desktop.
- Test recording MIME/playback on iOS and Android and preserve capability
  fallbacks.
- Verify focus, reduced motion, 200% text zoom, keyboard-open, and landscape.

**Verify**: the three code checks pass and dated device rows in
`docs/mobile-qa.md` pass; unavailable provider credentials are recorded.

### Step 4: Add installability, not fake offline support

Create `src/app/manifest.ts` with `MetadataRoute.Manifest` and stable `id: "/"`,
`scope: "/"`, `start_url: "/profile"`, `display: "standalone"`, brand colors,
192/512 icons, and a maskable-safe 512 icon. Add shortcuts for Catalog, Tonight,
and Journal only if the local type supports them.

Add a static `viewport` export only if needed for theme color/installed
rendering. Do not use request-time `generateViewport`; the local guide warns it
can block the root shell. Offer install help unobtrusively in setup/account UI,
detect standalone mode, explain iOS Share -> Add to Home Screen, and remember
dismissal. Do not depend on `beforeinstallprompt` as the only path.

Do not add cache-first fetch handling. A later push-only service worker must not
cache authenticated routes and must use the security/no-cache headers in the
local Next.js guide.

**Verify**: the manifest command returns expected fields and valid icon URLs;
browser application panels report installability; home-screen launch opens
`/profile` standalone; ordinary web navigation still works.

### Step 5: Add regression coverage and run the beta gate

If the team accepts a browser-test dependency, cover 360px/430px landing,
login, profile, catalog, Tonight, journal, game detail, bottom-bar visibility
and `aria-current`, absence on public/admin routes, safe-area overlap, manifest
and icons, and one authenticated mutation against a dedicated non-production
test database. Never weaken production auth for tests; keep mutation testing
manual and document the gap if a safe seed cannot be established.

Release to beta before funding native. Observe for 6-8 weeks: mobile session
share, completion of the four journeys, install uptake, mobile/upload errors,
and repeated requests the web cannot solve well.

**Verify**: lint, typecheck, tests, build, and any new browser test exit 0;
`docs/mobile-qa.md` contains a dated release matrix and limitations.

## Native-app decision gate

Open a native plan only when repeated evidence shows a high-value need the PWA
cannot deliver acceptably, such as a share extension, sustained background
work, platform integrations, or proven app-store acquisition. "It should feel
like an app" is not sufficient after standalone mode and mobile navigation.

If the gate is met:

1. Add versioned `/api/v1` route handlers around existing domain services;
   they must call the canonical catalog path.
2. Design browser OAuth plus universal/app links and rotating native tokens;
   do not blindly reuse web-cookie assumptions.
3. Build native Home, Catalog, Tonight, detail/status, and Journal first. Keep
   Sources/import/admin on web initially.
4. Share generated API/domain types, not React web components.
5. Budget store release, crash reporting, privacy disclosures, and staged QA.

Coarse estimate after the gate: 2-3 weeks for safe API/auth foundations and
6-9 more weeks for a credible cross-platform native MVP and release QA.

## Done criteria

- [ ] Four MVP journeys pass at 360, 390, 430px and small landscape.
- [ ] Real iPhone Safari and Android Chrome pass the dated matrix.
- [ ] Signed-in mobile routes use compact top and safe-area bottom navigation.
- [ ] Every profile section remains keyboard/touch reachable; public/admin routes do not show the product bar.
- [ ] Required touch targets are at least 44x44 CSS pixels on mobile.
- [ ] Photo/camera and voice recording pass supported-device tests or have clear fallbacks.
- [ ] Installed-mode provider callbacks pass, or missing-credential gaps are explicit.
- [ ] `/manifest.webmanifest` is valid with working 192/512/maskable icons.
- [ ] Home-screen launch opens `/profile` standalone on iOS and Android.
- [ ] No authenticated response or mutation is cached offline.
- [ ] Lint, typecheck, tests, and build exit 0.
- [ ] No files outside approved scope changed.
- [ ] Plan 017 is marked DONE only after beta-ready PWA delivery.

## STOP conditions

- Existing uncommitted work is not committed or isolated first.
- Live navigation/profile code no longer matches this plan.
- Standalone OAuth loses the session or requires provider-specific credentials.
- Work would duplicate canonical game/provider/user-entry resolution.
- Installability appears to require caching authenticated data or mutations.
- Automation would touch production because no safe test account exists.
- Work would move sync/import out of Sources or redesign desktop.
- A verification fails twice after a reasonable correction.

## Maintenance notes

- Four bottom-bar items is a deliberate density ceiling.
- Recheck safe areas when fixed banners/composers change; the beta banner and
  bottom bar can otherwise squeeze content.
- If push is proposed, begin with content/consent design and persistent
  per-device subscriptions. Permission must follow direct user interaction.
- A future native app should consume shared domain services, not scrape or wrap
  the Next.js UI.
