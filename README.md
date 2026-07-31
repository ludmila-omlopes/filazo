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
| AI features | `OPENAI_API_KEY` or `OPENROUTER_KEY` |
| Private journal media | a private Vercel Blob store and `BLOB_READ_WRITE_TOKEN` |

PlayStation sync exchanges a user-provided NPSSO for encrypted tokens and discards the NPSSO. CSV imports do not need provider credentials. Missing optional credentials disable only the relevant feature; catalog imports and sync continue where possible.

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

Automated provider sync is disabled by default. To enable it in production, configure `CRON_SECRET`, set `PLATFORM_SYNC_ENABLED=true`, and verify the scheduled internal route. Do not expose the cron secret in URLs, client code, logs, or monitoring labels. The complete sync settings are documented in [`.env.example`](./.env.example) and [`vercel.json`](./vercel.json).

## Localization and product direction

The interface ships in English and `pt-BR`. The locale is stored in the `filazo-locale` cookie; routes are not locale-prefixed.

Filazo is intentionally a calm catalog rather than a productivity dashboard. Preserve the canonical catalog model and the editorial, low-pressure interface when extending the product. Design tokens and voice guidance live in [`docs/`](./docs/).
