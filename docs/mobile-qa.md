# Mobile and PWA QA

Last updated: 2026-08-24 (UTC)

## Release status

**Not beta-ready yet.** The automated mobile-navigation baseline and online-first
PWA installability are in place, and the signed-out public shell has been checked
in headless Chrome. This environment still has no dedicated authenticated test
account or physical iPhone or Android device. Rows that require authenticated
journeys, real touch, media, installed-mode, or provider QA remain explicitly
pending; they must not be treated as passing evidence.

The implementation must remain online-first. No service worker, offline mutation
queue, authenticated response cache, or catalog cache is part of this release.

## Automated evidence

| Date | Check | Result | Notes |
| --- | --- | --- | --- |
| 2026-07-30 | `npx -y npm@11 ci` | PASS | Clean install matching the Node 26 CI toolchain; local npm 10 rejects the existing lockfile's peer-resolution shape. |
| 2026-07-30 | `node --experimental-strip-types --test tests/mobile-navigation.test.mjs` | PASS | Route visibility, `aria-current` policy, and mobile 44px compact-control classes. |
| 2026-07-30 | `npm test` | PASS | 161 tests passed. |
| 2026-07-30 | `npm run lint` | PASS | Exit 0 with three pre-existing `next/image` warnings and no errors. |
| 2026-07-30 | `npm run typecheck` | PASS | Next.js route types and TypeScript. |
| 2026-07-30 | `npm run build` | PASS | Next.js 16 production build completed. |
| 2026-07-30 | Public `GET /` and signed-out `GET /profile` from the local production server | PASS | Both returned HTTP 200 through the database-unavailable fallback; the signed-out response contained no product bottom-nav markup. No authenticated mutation or production environment was used. |
| 2026-07-30 | Headless Chrome public-shell screenshots at 390x844 and 844x390 | PASS (limited) | Compact logo/menu header, beta-banner spacing, no horizontal overflow, and readable public content were visually checked. Screenshots are local, non-sensitive QA artifacts. |
| 2026-07-30 | Headless Chrome responsive DOM checks at 430x932 and 768x1024 | PASS (limited) | Desktop nav remained hidden and the compact auth action remained visible; `scrollWidth` did not exceed `clientWidth`. At 1280x800 the desktop nav was visible and compact auth was hidden. |
| 2026-07-30 | Headless Chrome signed-out account menu at 390x844 | PASS (limited) | Locale, theme, and sign-in remained reachable; every rendered control measured at least 44x44 CSS pixels, the panel fit the viewport, Escape closed it, and the sign-in dialog opened. |
| 2026-07-30 | Authenticated browser journeys | BLOCKED | The local database is unavailable and no dedicated non-production test account exists. Authentication was not weakened and production mutations were not used. |
| 2026-08-21 | `npx -y npm@11 ci` | PASS | Clean install completed and Prisma Client generated from the unchanged schema. npm reported its existing dependency audit findings; no automated audit fix was applied. |
| 2026-08-21 | `npm run lint`, `npm run typecheck`, `npm test` | PASS | Lint exited 0 with the same three pre-existing `next/image` warnings; typecheck passed; all 174 tests passed, including PWA manifest, icon, standalone, platform-help, and dismissal coverage. |
| 2026-08-21 | `npm run build` | PASS | Next.js 16 production build completed and prerendered `/manifest.webmanifest` as a static route. The existing multi-lockfile workspace-root warning remains. |
| 2026-08-21 | Production server manifest and icon requests | PASS | `/manifest.webmanifest` returned HTTP 200 as `application/manifest+json`; 192px, 512px, and maskable 512px icons each returned HTTP 200. The landing HTML linked the manifest and included Apple installed-mode and light/dark theme-color metadata. |
| 2026-08-21 | Chrome DevTools Protocol manifest/installability inspection at 390x844 | PASS (limited) | Chrome loaded the expected manifest URL with no manifest errors. Its only installability error was `in-incognito`, which is inherent to the isolated headless browser context. A normal browser application-panel check and home-screen installation remain device QA. |
| 2026-08-24 | Account-menu lower boundary on short mobile viewports | PASS (automated), manual recheck pending | The menu now measures the live bottom-navigation and visual-viewport boundaries, caps its own scroll area above them, and recalculates after toggle, resize, page scroll, keyboard/visual-viewport resize, or visual-viewport scroll. The focused mobile-navigation test, full 174-test suite, typecheck, lint, and production build pass. |

## PWA installability status

- The manifest uses stable `id: "/"`, `scope: "/"`, `start_url: "/profile"`,
  and `display: "standalone"` with Catalog, Tonight, and Journal shortcuts.
- The account menu provides a Chromium install action when
  `beforeinstallprompt` is available, Safari instructions for iOS, generic
  browser-menu guidance elsewhere, standalone detection, and remembered
  dismissal.
- The release remains online-first. There is no service worker, fetch handler,
  offline cache, background sync, or mutation queue.
- Physical iOS/Android home-screen launch, installed-mode navigation, and
  provider callbacks remain **NOT RUN** and belong to the real-device gate.

## Viewport baseline

Run each row both signed in and signed out where relevant. Capture a screenshot
for the start and completion of each core journey, plus the open account menu.

| Viewport | Browser/emulation | Header | Profile content starts above rail | Bottom bar / safe area | Keyboard / zoom | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 360x800 portrait | Pending | Pending | Pending | Pending | Pending | NOT RUN |
| 390x844 portrait | Headless Chrome, signed out | PASS | Auth-required | N/A signed out | Pending | PARTIAL |
| 430x932 portrait | Headless Chrome, signed out | PASS | Auth-required | N/A signed out | Pending | PARTIAL |
| 768x1024 tablet portrait | Headless Chrome, signed out | PASS | Auth-required | N/A signed out | Pending | PARTIAL |
| 844x390 small landscape | Headless Chrome, signed out | PASS | Auth-required | N/A signed out | Pending | PARTIAL |

Required checks for every viewport:

- compact top bar has the brand and one account/overflow entry;
- signed-in `/profile`, `/tonight`, and `/games/[slug]` routes expose Home,
  Catalog, Tonight, and Journal in the bottom bar;
- landing, login, beta, terms, privacy, auth helper, and admin routes do not
  expose the product bottom bar;
- the full profile identity card and section rail do not precede active content
  below the desktop breakpoint;
- Sources, Calendar, player profile, Guide, Setup, language, theme, and sign-out
  remain keyboard- and touch-reachable from the account menu;
- `aria-current="page"` follows the current route/profile tab;
- fixed navigation does not cover cards, notices, forms, the footer, or focused
  controls, including with the beta banner present;
- primary and compact controls have at least 44x44 CSS-pixel touch areas;
- focus rings remain visible, reduced motion is respected, 200% text zoom does
  not clip content, and the open software keyboard does not hide the active
  field or submit action.

## Four MVP journeys

### 1. Current and queued games

1. Launch `/profile` while signed in.
2. Confirm current and playing-next content appears without the desktop rail
   above it at 360px, 390px, 430px, and small landscape.
3. Open the account menu and reach every secondary profile section.
4. Return through Home in the bottom bar.

Status: **NOT RUN while authenticated or on a physical device**.

### 2. Catalog search and game detail

1. Open Catalog from the bottom bar.
2. Search and filter the canonical catalog; switch list/grid views.
3. Open a game detail page and confirm Catalog remains current in the bar.
4. Use explicit Update status disclosure and save a status.

Status: **NOT RUN while authenticated or on a physical device**. No mutation
was sent to production.

### 3. Tonight and status update

1. Open Tonight from the bottom bar.
2. Choose a recommendation and open its detail.
3. Update status and return to Tonight.
4. Confirm required actions do not depend on hover.

Status: **NOT RUN while authenticated or on a physical device**. No mutation
was sent to production.

### 4. Journal text, photo, and voice

1. Open Journal from the bottom bar and save a text entry.
2. Select an existing image, then exercise the camera-oriented input.
3. Grant microphone permission, record, stop, play back, and upload a voice note.
4. Deny microphone permission and confirm the audio-file fallback remains clear.

Status: **NOT RUN while authenticated or on a physical device**. Camera,
microphone, playback, and upload require device QA.

## Real-device matrix

Use non-production test data. Record OS/browser versions, installed-vs-browser
mode, date, tester, and links to non-sensitive screenshots.

| Device | Browser mode | Four journeys | Camera/photo | Voice MIME/playback/upload | Google | Steam | Xbox | Safe areas / keyboard | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Real iPhone | Safari tab | Pending | Pending | Pending | Pending credentials | Pending credentials | Pending credentials | Pending | NOT RUN |
| Real iPhone | Installed standalone | Pending | Pending | Pending | Pending credentials | Pending credentials | Pending credentials | Pending | NOT RUN |
| Real Android phone | Chrome tab | Pending | Pending | Pending | Pending credentials | Pending credentials | Pending credentials | Pending | NOT RUN |
| Real Android phone | Installed standalone | Pending | Pending | Pending | Pending credentials | Pending credentials | Pending credentials | Pending | NOT RUN |

## Known gaps and STOP conditions

- Real iPhone Safari and Android Chrome evidence is required before this plan can
  be marked complete.
- Installed standalone OAuth has not been exercised. Missing provider
  credentials must be recorded rather than bypassed.
- No dedicated non-production authenticated browser-test account/database has
  been established, so automated mutations are intentionally omitted.
- Do not point browser automation at production or weaken authentication to make
  a test pass.
- If fixed navigation overlaps the beta banner, focused controls, or media
  composers on a device, stop release and correct the safe-area layout.
