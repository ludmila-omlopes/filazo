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

## Account plans

`User.plan` is the **manual grant**: `FREE` by default or `PRO` when granted by an admin. Paid access is stored separately in `BillingSubscription`. Effective Pro access is a manual grant OR an eligible, paid subscription in the current payment environment. Billing never overwrites manual grants. No existing feature is restricted yet; the subscription page clearly states that exclusive features are still in preparation.

Admins can search accounts and grant or revoke manual Pro at `/admin/plans`. Both the page and its server action verify the signed-in admin; changing a grant does not charge the user or cancel their subscription. Stale forms cannot overwrite a concurrent grant change. The effective plan is shown on the profile Home tab. Users open `/account/billing` from the header, mobile account menu or plan link on their profile.

For future exclusive features, call `requireProAccess()` from `src/lib/pro-access.ts` inside the server action or route handler before doing any protected work. It verifies the session and platform access, reads the current account from the database, and throws `ProRequiredError` (`code: PRO_REQUIRED`) for Free accounts. Handle that error with localized upgrade messaging (and HTTP 403 in an API). `hasProAccess(user)` from `src/lib/account-plans.ts` is available for rendering; hiding UI alone is not authorization. Admin and beta status do not automatically grant Pro.

Before running the updated app, apply `prisma/migrations/20260911120000_add_account_plan/migration.sql` and `prisma/migrations/20260911160000_add_stripe_billing/migration.sql` through your migration workflow (once each), or run `npm run db:init` for schema bootstrap, then `npm run db:generate`. The billing migration only creates billing tables and indexes. It does not change any existing user's plan. `npm run db:check` verifies compatibility.

### Stripe setup: Brazil, R$ 4.99/month

The first offer is a monthly card subscription in BRL at **499 centavos**. Price, currency, interval and quantity are validated on the server; clients cannot supply them. Checkout uses Portuguese, collects a billing address, disables adaptive currency conversion, and requires confirmation of Brazilian residence and the recurring charge before proceeding. This is a customer declaration, not IP geofencing or a restriction to Brazilian-issued cards. Pix and boleto are not enabled in this version.

1. Configure a Stripe account and set a **test** `STRIPE_SECRET_KEY` in your local `.env`. Keep `STRIPE_BILLING_ENABLED=false`. Never put secret keys in `NEXT_PUBLIC_*` variables.
2. Run `npm run billing:setup`. It creates/reuses the R$ 4.99 monthly price and a dedicated customer portal configuration. Save its returned `STRIPE_PRO_MONTHLY_PRICE_ID` and `STRIPE_PORTAL_CONFIGURATION_ID` in `.env`. The script does not enable checkout or create a subscription.
3. Run `npm run billing:listen` in a separate terminal alongside `npm run dev`. It runs the pinned official Stripe CLI through npm, forwards test notifications to port 3001, and saves `STRIPE_WEBHOOK_SECRET` directly in the ignored local `.env` without printing it. Keep the listener running during local payment tests; restart it after restarting your computer. It accepts test keys only and does not enable checkout. For a deployed endpoint, register `/api/billing/webhook` in Stripe Workbench using the API version printed by `billing:setup` (currently `2026-08-26.dahlia`).
4. Subscribe to `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused`, `customer.subscription.resumed`, `invoice.paid`, `invoice.payment_failed`, and `invoice.payment_action_required`.
5. Set `APP_URL=http://localhost:3001`, `STRIPE_BILLING_MODE=test`, and `STRIPE_BILLING_ENABLED=true` for local test checkout. Test successful payment, declined payment, additional card authentication, renewal, cancellation, and duplicate webhook delivery. Test-mode records cannot grant live-mode access.
6. To launch, configure live credentials and the HTTPS production `APP_URL`, then run `npm run billing:setup -- --live` with the live key to create the live price/portal. Configure the live webhook and its own signing secret. Set the live IDs, `STRIPE_BILLING_MODE=live`, and enable checkout only after verifying the integration. Production requires a live key regardless of `STRIPE_BILLING_MODE`; Vercel Preview can use test mode.

Required environment variables are listed in `.env.example`. Missing configuration or disabled checkout leaves the library and manual Pro grants working. Disabling checkout does not disable webhooks, payment status checks or subscription management, so existing customers can still cancel. The portal must allow payment-method updates and cancellation **at period end**, with subscription price changes disabled; the server verifies this configuration before checkout or portal access.

Checkout sessions and customers use deterministic idempotency keys and a per-customer database lock, so concurrent clicks and retries after database failures reuse the same Stripe objects. Existing non-terminal subscriptions block another purchase. A signed-in customer can only open their own checkout and portal. Users whose beta access expired can still manage/cancel a paid subscription, but cannot start a new one until platform access is restored.

The webhook verifies Stripe's signature against the raw body, then synchronizes the latest subscription under the same database lock. A unique event record and subscription update commit together; failures return HTTP 500 for retry. Notifications received out of order read current provider state. Only paid invoice lines for the recognized subscription item extend `paidThrough`; an active subscription without a paid invoice or a successful redirect cannot activate Pro. Unknown products and mismatched customers are never granted access. `active` and `past_due` subscriptions only retain access while the paid period remains valid; canceled, unpaid, paused, incomplete and expired subscriptions do not. There is no extra grace period after a failed renewal.

On the return page, short polling waits for webhook confirmation. The authenticated **Check payment status** action reconciles provider state if a notification is delayed. `BillingCustomer` and `BillingSubscription` separate test/live data; webhook records retain only event identifiers/type/mode, not full payment payloads. Card details stay with Stripe. Refund handling is manual in Stripe for this initial release; a refund alone does not cancel a subscription, so access decisions accompanying a refund must also update/cancel the subscription. No automatic refund workflow is implemented.

References: [Stripe subscriptions](https://docs.stripe.com/billing/subscriptions/webhooks), [webhook handling](https://docs.stripe.com/webhooks), [customer portal](https://docs.stripe.com/customer-management).

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
| Library chat web search | Uses the configured OpenAI or OpenRouter key and model; no separate search key required |
| Private journal media | a private Vercel Blob store and `BLOB_READ_WRITE_TOKEN` |

PlayStation sync exchanges a user-provided NPSSO for encrypted tokens and discards the NPSSO. GOG opens the login on GOG's site, validates a short-lived `state`, accepts the final redirect URL pasted by the user, and stores only encrypted OAuth tokens. The GOG integration uses undocumented Galaxy endpoints, imports only games owned directly on GOG, and can break if those endpoints change. CSV imports do not need provider credentials. Missing optional credentials disable only the relevant feature; catalog imports and sync continue where possible.

Feedback cards include a two-way comment thread for identified users. The user can reply while the card is open; moving it to `DONE` or `DECLINED` closes the conversation. Run `npm run db:init` after deploying schema changes so the `FeedbackComment` table is available.

The board statuses are `NEW`, `IN_REVIEW`, `WAITING`, `DONE`, and `DECLINED`. `WAITING` (Aguardando) keeps the conversation open and sends the same status-change notification as other moves. Apply the `20260909180000_add_feedback_waiting_status` migration or the existing `npm run db:init` schema bootstrap before using it.

### Game page localization

Game detail pages separate public information, your experience, and community activity. For signed-in users viewing Portuguese, the synopsis is translated using the configured AI provider, the assistant-summary enable switch/output limit, and the existing daily spend budget. Successful translations are cached per user in `AssistantRun` with status `GAME_SUMMARY_TRANSLATED`, keyed by canonical game ID, locale, and a hash of the original synopsis. Updated source text invalidates the cache. `Game.summary` stays unchanged. Missing credentials, disabled AI, exhausted budget, or incomplete output show a localized fallback with the original English synopsis. Personal notes and imported reviews retain their original language. No database migration or new environment variable is required.

### Library chat web search

Ask the library chat to search the internet for game announcements, unfamiliar titles, or current information. It calls `search_web` only when needed, then shows clickable provider-supplied sources alongside the answer. Searches receive a short public query, without attaching the chat history or library. Search results do not add or modify catalog games.

OpenRouter uses its [web plugin](https://openrouter.ai/docs/guides/features/plugins/web-search) with the Exa engine and up to five results. Direct OpenAI uses [Responses web search](https://developers.openai.com/api/docs/guides/tools-web-search) with the configured model, which must support that tool. Other compatible gateways keep library chat but return a clear search-unavailable result. Provider failures, timeouts, and missing citations do not become uncited claims of a successful search.

Each reply allows one search, with a 25-second search timeout and at most 1,600 search output tokens. Search tokens count toward the existing daily chat allowance. A separate budget reservation includes an estimated USD 0.01 search fee plus model token estimates; this is an application estimate, not an exact provider bill. Failed requests retain the reservation as other AI failures do. The chat reserves its last step for a written answer, with at least two steps even if the admin setting is one.

Before a search, the app reserves 5,600 tokens (4,000 estimated input plus 1,600 output). If the remaining rolling daily chat allowance or spending allowance cannot cover the reservation, the search is not sent. The chat displays the specific quota reason instead of reporting a web outage, and records `webSearchBudgetReason` in the chat budget output for diagnosis. Actual provider token usage replaces the search estimate after a successful call.

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
