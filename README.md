# filazo

A calm, personal game library. Filazo gathers games from multiple sources into one canonical catalog, so a title imported from Steam, PlayStation, Xbox, or CSV resolves to the same game instead of producing duplicates.

## Stack

- Next.js 16 (App Router) and React 19
- TypeScript, Tailwind CSS 4, and Prisma 6
- PostgreSQL
- Signed cookie sessions

## What it does

- Maintains a personal catalog of owned, wishlist, backlog, and currently played games.
- Syncs Steam libraries, PlayStation purchases/trophies, and Xbox achievement/recent-title history.
- Imports generic, PlayStation, and Xbox CSV exports; photo import is available when AI is configured.
- Enriches titles with optional IGDB, HowLongToBeat, and Steam-provided Metacritic metadata.
- Offers game pages, journals, reviews, completion tracking, play-next suggestions, and an optional AI assistant.
- Supports English and Brazilian Portuguese.

> **Catalog rule:** `Game` is the shared canonical record. `GameProviderLink` maps a provider's IDs to it, and `UserGameEntry` stores a person's ownership, progress, and status. New integrations must use this resolution flow.

Beta application intake is stored in `BetaSettings`. Admins can open or close applications, while the activity view uses `User.lastActiveAt` to summarize approved testers as active or inactive. The top beta banner follows the application setting and directs current testers to Discord or `/feedback`.

Feedback from signed-in users is attached to their account; authentication failure reports may be submitted anonymously so a person can contact support before a session is established.

## Requirements

- Node.js 22.5 or newer (CI uses Node 26)
- npm
- PostgreSQL

## Get started

```bash
npm install
cp .env.example .env
# Set DATABASE_URL and AUTH_SECRET in .env
npm run db:init
npm run dev
```

The app runs at [http://localhost:3001](http://localhost:3001).

### Required environment variables

```env
DATABASE_URL="postgresql://USER:***@HOST:5432/filazo?schema=public"
APP_URL="http://localhost:3001"
AUTH_SECRET="a-long-random-secret"
```

`DATABASE_URL` must be PostgreSQL; SQLite `file:` URLs are rejected. See [`.env.example`](./.env.example) for every optional integration and operational setting.

### Optional integrations

| Capability | Variables / setup |
| --- | --- |
| Steam owned-library sync | `STEAM_API_KEY` (Steam sign-in itself uses OpenID) |
| Google sign-in and beta applications | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| Xbox account sync | `XBOX_CLIENT_ID`, `XBOX_CLIENT_SECRET` |
| Game metadata | `IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET` |
| Approval email | `RESEND_API_KEY`, `BETA_APPROVAL_FROM_EMAIL` |
| Feedback conversations | Uses the approval email configuration to notify users and support about replies |
| AI features | `OPENAI_API_KEY` or `OPENROUTER_KEY` |
| Private journal media | a private Vercel Blob store and `BLOB_READ_WRITE_TOKEN` |

PlayStation sync exchanges a user-provided NPSSO for encrypted tokens and discards the NPSSO. CSV imports do not need provider credentials. Missing optional credentials disable only the relevant feature; catalog imports and sync continue where possible.

Feedback cards include a two-way comment thread for identified users. The user can reply while the card is open; moving it to `DONE` or `DECLINED` closes the conversation. Run `npm run db:init` after deploying schema changes so the `FeedbackComment` table is available.

The board statuses are `NEW`, `IN_REVIEW`, `WAITING`, `DONE`, and `DECLINED`. `WAITING` (Aguardando) keeps the conversation open and sends the same status-change notification as other moves. Apply the `20260909180000_add_feedback_waiting_status` migration or the existing `npm run db:init` schema bootstrap before using it.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local server on port 3001 |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Generate Next types and run TypeScript without emitting files |
| `npm test` | Run the Node test suite |
| `npm run build` | Create a production build |
| `npm run db:init` | Validate `DATABASE_URL` and apply the Prisma schema |
| `npm run db:generate` | Generate Prisma Client |

Before opening a pull request, run:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

GitHub Actions runs the same checks for pull requests and pushes to `master`.

## Architecture map

```text
src/
  app/                 routes, server actions, and API handlers
  components/          interface components
  lib/catalog.ts       canonical resolution, imports, and platform sync
  lib/providers/       provider contracts and adapters
  lib/assistant/       recommendation and library-assistant logic
  lib/steam.ts         Steam OpenID and Web API integration
  lib/playstation.ts   PlayStation token and library integration
  lib/xbox.ts          Microsoft/Xbox OAuth and sync
  lib/igdb.ts          optional metadata enrichment
prisma/schema.prisma   data model
prisma/migrations/     migration history
scripts/init-db.mjs    database bootstrap guard
```

Read [`AGENTS.md`](./AGENTS.md) before changing catalog resolution, provider integrations, schema, or UI. It documents the product constraints and implementation rules.

## Deployment

Deploy on Vercel or another host capable of reaching PostgreSQL. Set at least `APP_URL`, `AUTH_SECRET`, and `DATABASE_URL`, then apply the schema with `npm run db:init`.

Runtime exceptions are reported to the `emada/filazo` Sentry project. Handled database failures are tagged with their route, operation, and Prisma error code without attaching user data or HTTP request bodies. Connect the official Sentry integration in Vercel so production builds can upload source maps without committing `SENTRY_AUTH_TOKEN`.

Steam imports run in the background. The Sources action saves a `PlatformSyncRun` and returns immediately; users can navigate away or close the tab. A server worker stores the Steam response once and commits canonical resolution, ownership and the cursor together for each game. Runs use bounded batches with expiring leases, automatic backoff and recovery after a process restart. Duplicate clicks reuse the active run. After repeated failures, a manual retry resumes the saved snapshot in a new audit run. Disconnecting the Steam account cancels its queued work. Optional metadata is enriched separately through `GameMetadataJob`.

Before deploying this change, apply `prisma/migrations/20260909190000_background_steam_sync/migration.sql` to existing databases (or run `npm run db:init` when bootstrapping the current schema), and generate the Prisma client normally. Stop local Next processes before regenerating the client on Windows. Do not generate an engine-free client for a direct PostgreSQL URL.

Production requires `CRON_SECRET` and the minute schedules in `vercel.json` for `/api/internal/steam-sync-worker` and `/api/internal/game-metadata-worker`. Both endpoints require `Authorization: Bearer <CRON_SECRET>` and must be invoked by server infrastructure, even with no open browsers. They continue accepted manual imports when `PLATFORM_SYNC_ENABLED=false`. The initial batch also runs through Next.js `after`; cron handles subsequent batches and recovery. On hosts without Vercel Cron, configure an equivalent authenticated minute scheduler. Worker leases last 90 seconds; interrupted work becomes eligible after expiry. Deployments use `VERCEL_ENV` (or `NODE_ENV` outside Vercel) to separate development, preview and production workers; use separate databases per environment as usual. Preview deployments require their own scheduler for sustained imports, because Vercel Cron runs only in production.

`npm run dev` starts the app and independent local worker polling; queued jobs resume when the dev server restarts. It generates a private temporary cron secret if one is not configured. Production uses the configured secret. The account timeout setting applies to PlayStation and Xbox; Steam uses checkpointed execution windows instead of a timeout for the whole library.

Automated daily provider sync is disabled by default. To enable it, set `PLATFORM_SYNC_ENABLED=true` and verify `/api/internal/platform-sync`, which enqueues Steam work and retains the existing PlayStation/Xbox flow. Do not expose the cron secret in URLs, client code, logs, or monitoring labels. The complete sync settings are documented in [`.env.example`](./.env.example) and [`vercel.json`](./vercel.json).

Run `npm run test:steam-sync` with a PostgreSQL `DATABASE_URL` to verify queue concurrency, interruption/recovery, canonical matching, retries and libraries larger than one batch. The harness creates a uniquely named isolated schema and removes it afterwards; it uses fake provider responses and does not import into real users' libraries or contact Steam/metadata services.

## Localization and product direction

The interface ships in English and `pt-BR`. The locale is stored in the `filazo-locale` cookie; routes are not locale-prefixed.

Filazo is intentionally a calm catalog rather than a productivity dashboard. Preserve the canonical catalog model and the editorial, low-pressure interface when extending the product. Design tokens and voice guidance live in [`docs/`](./docs/).
