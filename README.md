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
- Classifies games as campaign, ongoing, hybrid, or unknown; the profile structure filter is opt-in and starts inactive.
- Supports English and Brazilian Portuguese.

Game structure uses main-story estimates and story-completion trophies as campaign evidence; solo or cooperative play alone does not establish a campaign. Automatic classifications are recalculated from current evidence, while manual choices retain their value and provenance. Existing titles with missing game modes become eligible for metadata enrichment on library sync or a game-page visit, respecting the seven-day retry interval. An empty modes response is considered fetched and does not trigger repeated searches. Apply the current schema with `npm run db:init` before deploying this feature.

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
| Experimental GOG browser sync | `GOG_CLIENT_ID`, `GOG_CLIENT_SECRET`, optionally `GOG_REDIRECT_URI` |
| Game metadata | `IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET` |
| Approval email | `RESEND_API_KEY`, `BETA_APPROVAL_FROM_EMAIL` |
| Feedback conversations | Uses the approval email configuration to notify users and support about replies |
| AI features | `OPENAI_API_KEY` or `OPENROUTER_KEY` |
| Store prices and preorders | Same AI credentials/model; OpenRouter web plugin (Exa) or OpenAI Responses `web_search` support required |
| Private journal media | a private Vercel Blob store and `BLOB_READ_WRITE_TOKEN` |

PlayStation sync exchanges a user-provided NPSSO for encrypted tokens and discards the NPSSO. GOG opens the login on GOG's site, validates a short-lived `state`, accepts the final redirect URL pasted by the user, and stores only encrypted OAuth tokens. The GOG integration uses undocumented Galaxy endpoints, imports only games owned directly on GOG, and can break if those endpoints change. CSV imports do not need provider credentials. Missing optional credentials disable only the relevant feature; catalog imports and sync continue where possible.

Feedback cards include a two-way comment thread for identified users. The user can reply while the card is open; moving it to `DONE` or `DECLINED` closes the conversation. Run `npm run db:init` after deploying schema changes so the `FeedbackComment` table is available.

The board statuses are `NEW`, `IN_REVIEW`, `WAITING`, `DONE`, and `DECLINED`. `WAITING` (Aguardando) keeps the conversation open and sends the same status-change notification as other moves. Apply the `20260909180000_add_feedback_waiting_status` migration or the existing `npm run db:init` schema bootstrap before using it.

### Game page localization

Game detail pages separate public information, your experience, and community activity. For signed-in users viewing Portuguese, the synopsis is translated using the configured AI provider, the assistant-summary enable switch/output limit, and the existing daily spend budget. Successful translations are cached per user in `AssistantRun` with status `GAME_SUMMARY_TRANSLATED`, keyed by canonical game ID, locale, and a hash of the original synopsis. Updated source text invalidates the cache. `Game.summary` stays unchanged. Missing credentials, disabled AI, exhausted budget, or incomplete output show a localized fallback with the original English synopsis. Personal notes and imported reviews retain their original language. No database migration or new environment variable is required.

### Store and preorder search

In the purchase decision form, enter/select a title, choose a store region, then use **Find stores and prices**. AI searches the live web across all platforms for direct store listings, including preorders and physical copies. The form's platform field does not filter store searches; each result identifies its own platform and edition alongside its source link, availability and lookup time. Only explicitly sourced prices in the selected region's currency can be copied into the price field. Announced/wishlist-only pages are distinguished from confirmed preorders; missing prices remain unconfirmed. Changing title or region clears previous results and cancels the browser request; changing the form's platform keeps the store results visible.

This uses the existing provider configuration (`OPENROUTER_KEY` takes precedence, `OPENAI_MODEL` selects the model, and `AI_PROVIDER_BASE_URL` / `OPENAI_BASE_URL` retain their existing behavior). Each lookup runs five independent searches: PlayStation, Xbox/Microsoft, PC stores, Nintendo, and retailers/publishers. This prevents one store's search ranking from crowding out other platforms. Each group verifies up to three discovered pages independently. Known PlayStation and Xbox product paths are localized to the requested region while preserving the discovered product identifier, so an American search result can lead to verification of the Brazilian product page.

Custom gateways must forward web-search tools and source citations. After discovery, AI rechecks readable store page text to identify delivery terms, availability and prices; unrelated titles, upgrades, account access and gift-card promotions are excluded. Server-side retrieval is restricted to the known storefront domains in `src/lib/assistant/marketplace-search.ts`, including redirects. A discovered listing that cannot be read or verified remains as an unconfirmed link with no price. Failure in one group preserves the other groups' results, and the UI discloses incomplete searches. If all searches fail, the API returns a retryable error.

API access requires a signed-in user and runs under the assistant-summary enable switch and daily AI spend budget, recorded as `assistant_marketplace`. Each lookup reserves up to ten model calls, 120,000 input / 40,000 output tokens plus $0.05 for search tools; this is a conservative estimate, not exact provider billing. There is no database migration or catalog mutation. Search results are not exhaustive, and final prices and availability must be confirmed at the store.

Provider references: [OpenAI web search](https://developers.openai.com/api/docs/guides/tools-web-search), [OpenRouter web search](https://openrouter.ai/docs/guides/features/plugins/web-search).

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
| `npm run db:check` | Read-only compatibility check for all client tables, columns and enum values |

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
  lib/gog.ts           experimental GOG browser OAuth and owned-library sync
  lib/igdb.ts          optional metadata enrichment
prisma/schema.prisma   data model
prisma/migrations/     migration history
scripts/init-db.mjs    database bootstrap guard
```

Read [`AGENTS.md`](./AGENTS.md) before changing catalog resolution, provider integrations, schema, or UI. It documents the product constraints and implementation rules.

## Deployment

Deploy on Vercel or another host capable of reaching PostgreSQL. Set at least `APP_URL`, `AUTH_SECRET`, and `DATABASE_URL`. Apply reviewed schema changes **before** deploying the code that uses them (`npm run db:init` is available for schema bootstrap).

`npm run build` generates Prisma Client and runs `db:check` before Next.js builds. A missing table, column, enum value, or unreachable database fails the deployment so an incompatible build cannot replace the live version. Vercel builds also fail if `DATABASE_URL` is missing. Offline local/CI builds may skip the database check when no URL is configured; CI separately exercises it against isolated PostgreSQL. Build overrides must retain this prebuild step. This check is read-only and does not apply migrations or guarantee protection against outages after deployment.

For the game-structure release, apply `prisma/migrations/20260910180000_game_completion_structure/migration.sql` and `prisma/migrations/20260910181000_complete_provider_enums/migration.sql` before deploying. These scripts only add missing columns/types/enum values, preserve existing records, and can be rerun safely. User-facing database errors are localized site-failure messages; technical diagnostics stay in monitoring. The profile fallback offers retry and the configured Discord support link, which does not depend on database access.

Runtime exceptions are reported to the `emada/filazo` Sentry project. Handled database failures are tagged with their route, operation, and Prisma error code without attaching user data or HTTP request bodies. Connect the official Sentry integration in Vercel so production builds can upload source maps without committing `SENTRY_AUTH_TOKEN`.

Steam imports run in the background. The Sources action saves a `PlatformSyncRun` and returns immediately; users can navigate away or close the tab. A server worker stores the Steam response once and commits canonical resolution, ownership and the cursor together for each game. Runs use bounded batches with expiring leases, automatic backoff and recovery after a process restart. Duplicate clicks reuse the active run. After repeated failures, a manual retry resumes the saved snapshot in a new audit run. Disconnecting the Steam account cancels its queued work. Optional metadata is enriched separately through `GameMetadataJob`.

Before deploying this change, apply `prisma/migrations/20260909190000_background_steam_sync/migration.sql`, `prisma/migrations/20260910124000_steam_user_game_provider_links/migration.sql`, and `prisma/migrations/20260910170000_add_gog_browser_sync/migration.sql` to existing databases (or run `npm run db:init` when bootstrapping the current schema), and generate the Prisma client normally. The provider-link migration creates the existing `UserGameProviderLink` model on databases that did not receive it through `db push`; it is safe to apply if the table already exists. Stop local Next processes before regenerating the client on Windows. Do not generate an engine-free client for a direct PostgreSQL URL.

Production requires `CRON_SECRET` and the minute schedules in `vercel.json` for `/api/internal/steam-sync-worker` and `/api/internal/game-metadata-worker`. Both endpoints require `Authorization: Bearer <CRON_SECRET>` and must be invoked by server infrastructure, even with no open browsers. They continue accepted manual imports when `PLATFORM_SYNC_ENABLED=false`. The initial batch also runs through Next.js `after`; cron handles subsequent batches and recovery. On hosts without Vercel Cron, configure an equivalent authenticated minute scheduler. Worker leases last 90 seconds; interrupted work becomes eligible after expiry. Deployments use `VERCEL_ENV` (or `NODE_ENV` outside Vercel) to separate development, preview and production workers; use separate databases per environment as usual. Preview deployments require their own scheduler for sustained imports, because Vercel Cron runs only in production.

`npm run dev` starts the app and independent local worker polling; queued jobs resume when the dev server restarts. It generates a private temporary cron secret if one is not configured. Production uses the configured secret. The account timeout setting applies to PlayStation and Xbox; Steam uses checkpointed execution windows instead of a timeout for the whole library.

Automated daily provider sync is disabled by default. To enable it, set `PLATFORM_SYNC_ENABLED=true` and verify `/api/internal/platform-sync`, which enqueues Steam work and retains the existing PlayStation/Xbox flow. GOG scheduling is separately opt-in with `PLATFORM_SYNC_GOG_ENABLED=true` because it depends on undocumented endpoints. Do not expose the cron secret in URLs, client code, logs, or monitoring labels. The complete sync settings are documented in [`.env.example`](./.env.example) and [`vercel.json`](./vercel.json).

Run `npm run test:steam-sync` with a PostgreSQL `DATABASE_URL` to verify queue concurrency, interruption/recovery, canonical matching, retries and libraries larger than one batch. The harness creates a uniquely named isolated schema and removes it afterwards; it uses fake provider responses and does not import into real users' libraries or contact Steam/metadata services.

### Sync incident monitoring

Apply `prisma/migrations/20260910140000_sync_incident_monitoring/migration.sql` once to existing databases before deploying the monitor (or use `npm run db:init` for a fresh/current schema). Generate the Prisma client normally afterwards. This adds incident membership, email delivery state, real progress timestamps and system feedback comments; it preserves existing feedback and library data.

The authenticated `/api/internal/sync-monitor` cron runs every minute independently of the import workers and `PLATFORM_SYNC_ENABLED`. It only processes production runs and does nothing in development or preview. A terminal failure or 15 minutes without progress opens an admin-only BUG card in `/admin/feedback`; intentional provider backoff is respected. Steam application credential failures are grouped across users. The scan uses a persistent cursor and a lease, so larger account sets are covered over successive bounded invocations. On other hosts, schedule this endpoint with the same `Authorization: Bearer <CRON_SECRET>` header.

Each incident sends an email to `ADMIN_EMAIL` using the existing `RESEND_API_KEY`, `BETA_APPROVAL_FROM_EMAIL`, `BETA_APPROVAL_REPLY_TO` and `APP_URL` settings. Delivery state is persisted, retries use backoff and a stable provider idempotency key, and ordinary progress does not send more email. If email is missing or unavailable, the card still exists and `/admin/sync` shows the delivery failure. System comments record changed errors, retries, recovery and disconnection. Recovery leaves the card open until an admin closes it; closing acknowledges that run, while a new failed run can open a new incident.

The protected `/admin/sync` page shows affected users, progress, errors, recovered incidents awaiting closure and recent production runs. It refreshes every 30 seconds while visible and warns if the monitor has not completed a scan recently. Run `npm run test:sync-monitor` for isolated PostgreSQL checks covering concurrent scans, grouping, email retries, recovery, closure, recurrence, disconnects and stalled work. All email deliveries are simulated. The PostgreSQL test harness uses Neon's direct hostname for schema isolation, since schema DDL needs session continuity; see [Neon connection pooling](https://neon.com/docs/connect/connection-pooling).

## Localization and product direction

The interface ships in English and `pt-BR`. The locale is stored in the `filazo-locale` cookie; routes are not locale-prefixed.

Filazo is intentionally a calm catalog rather than a productivity dashboard. Preserve the canonical catalog model and the editorial, low-pressure interface when extending the product. Design tokens and voice guidance live in [`docs/`](./docs/).
