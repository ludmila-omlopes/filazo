# Checkpoint

Checkpoint is a game library app built with Next.js 16, React 19, Prisma, and SQLite.
It is designed around a canonical local game catalog that can absorb data from multiple sources:

- Steam account sign-in and owned library sync
- CSV imports for backlog and wishlist exports
- IGDB metadata enrichment for covers, release dates, platforms, screenshots, and ratings
- HowLongToBeat completion-time enrichment for main story, main + extras, and completionist estimates
- Optional rule-based and AI-assisted backlog assistance

The current app already includes a landing page, a collector profile, Steam authentication, Steam sync, CSV mapping/import, and per-game catalog pages.

## Stack

- Next.js 16 App Router
- React 19
- Prisma 6
- SQLite
- Tailwind CSS 4
- JOSE-based signed cookie sessions

## Core Product Model

The app is centered on a canonical `Game` record.

- `Game` stores the normalized catalog entry and any IGDB metadata
- `GameProviderLink` links a canonical game to an external provider ID like a Steam app ID
- `UserGameEntry` stores user ownership, wishlist state, playtime, last played date, and completion percentage for a game
- `UserGameInsight` stores per-game assistant signals such as untouched, sampled-dropped, wishlist risk, and release candidates
- `AssistantRun` stores each assistant refresh summary and optional AI output metadata
- `ExternalAccount` stores connected provider accounts like Steam
- `ImportJob` and `ImportRow` keep an audit trail of CSV imports

This means multiple providers can eventually point to the same internal game instead of creating duplicate records.

## Features

- Steam OpenID sign-in
- Steam owned games sync with playtime, last played date, and achievement-based completion percentages when Steam exposes the data
- CSV upload with in-browser column mapping for titles, status, playtime, completion percentage, notes, and external IDs
- IGDB best-match enrichment during imports and sync
- Best-effort HowLongToBeat enrichment during imports and sync
- Collector profile page with owned and wishlist sections
- Canonical game detail pages
- Assistant tab with backlog friction insights, play-next picks, release candidates, and buy-decision guidance

## Requirements

- Node.js 20+
- npm

Optional, depending on what you want to use:

- Steam Web API key for owned library sync
- IGDB client credentials for metadata enrichment

HowLongToBeat enrichment uses an unofficial website-backed lookup and does not require credentials.

## Environment Variables

Copy `.env.example` to `.env` and fill in what you need.

```env
DATABASE_URL="file:./dev.db"
APP_URL="http://localhost:3000"
AUTH_SECRET="replace-with-a-long-random-string"

# Steam
STEAM_API_KEY=""

# IGDB / Twitch
IGDB_CLIENT_ID=""
IGDB_CLIENT_SECRET=""

# Optional AI assistant
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-5.4-mini"
```

Notes:

- `AUTH_SECRET` should be a long random string in any non-local environment.
- `STEAM_API_KEY` is required for owned library sync. Steam sign-in itself uses OpenID.
- IGDB enrichment is optional. If IGDB credentials are missing, the app still works, but imported/synced games stay with local metadata only.
- HowLongToBeat enrichment is optional and best-effort. If the website-backed search is unavailable, imports and Steam sync continue without completion-time estimates.
- The Assistant tab works without AI. If `OPENAI_API_KEY` is set, the app can use OpenAI's Responses API to turn rule-based insights into short explanations. Only library summaries, selected game metadata, and rule outputs are sent.

## Getting Started

1. Install dependencies.

```bash
npm install
```

2. Create `.env` from `.env.example`.

3. Initialize the SQLite database.

```bash
npm run db:init
```

4. Generate the Prisma client if needed.

```bash
npm run db:generate
```

5. Start the dev server.

```bash
npm run dev
```

Open `http://localhost:3000`.

## Database Notes

This project currently uses SQLite and includes two database-related pieces:

- [prisma/schema.prisma](./prisma/schema.prisma) as the source Prisma schema
- [scripts/init-db.mjs](./scripts/init-db.mjs) as a direct SQLite bootstrap script

Current scripts:

- `npm run db:init`: creates the SQLite tables and indexes
- `npm run db:push`: currently points to the same bootstrap script
- `npm run db:generate`: generates Prisma Client

Important: `db:push` is not running `prisma db push` right now. It is an alias to the custom bootstrap script. If you later move to Prisma-managed migrations, update this section and the scripts accordingly.

## Available Scripts

- `npm run dev`: start the Next dev server
- `npm run build`: build for production
- `npm run start`: start the production server
- `npm run lint`: run ESLint
- `npm run db:init`: initialize the SQLite database
- `npm run db:push`: currently same as `db:init`
- `npm run db:generate`: generate Prisma Client

## How the App Works

### Steam flow

1. The user starts at `/api/auth/steam`.
2. The app redirects to Steam OpenID.
3. Steam returns to `/api/auth/steam/callback`.
4. The callback verifies the OpenID response, creates or reuses a local user, stores the Steam account, and sets a signed session cookie.
5. From the profile page, the user can run a Steam sync to fetch owned games and attach them to canonical catalog entries.

### CSV flow

1. The user uploads a CSV on the profile page.
2. The browser parses the file and shows a column-mapping UI.
3. A server action receives the raw CSV plus selected mappings.
4. Each row is normalized into a canonical game resolution attempt.
5. Import results are recorded in `ImportJob` and `ImportRow`.

### Catalog resolution

Whenever a game comes from Steam or CSV:

1. The app checks for an existing provider link when a provider ID is available.
2. It checks for an existing game by normalized title.
3. It tries to enrich the record with IGDB and HowLongToBeat.
4. It creates or updates the canonical `Game`.
5. It links external provider IDs, including HLTB IDs when available, through `GameProviderLink`.
6. It stores the user-facing entry in `UserGameEntry`.

Steam sync stores `lastPlayedAt` from Steam's `rtime_last_played` field when Steam returns it. It also tries to calculate `completionPercent` from achievements by comparing unlocked achievements to the total achievements returned for each app. Both are best-effort: games without last-played data or Steam achievements, private or blocked stats, and temporary API failures are left untracked.

HowLongToBeat stores completion estimates on the canonical `Game` as minutes and links the HLTB game ID through `GameProviderLink`. HLTB does not expose an official public API, so failures or search misses are ignored instead of blocking catalog resolution.

### Assistant flow

1. The user opens `/profile?tab=assistant`.
2. A server action refreshes deterministic insights from `UserGameEntry` data such as status, playtime, last played date, completion, favorites, and genres.
3. Insights are stored in `UserGameInsight`; each `AssistantRun` keeps a compact audit trail of the input summary and output summary.
4. If OpenAI credentials are configured, the app asks for a structured explanation. If the request fails or credentials are missing, deterministic fallback text is used.
5. The buy-decision helper compares a candidate title against owned/wishlist/backlog patterns and returns buy, wait, wishlist, or skip guidance.

## Project Structure

```text
src/
  app/
    api/auth/steam/           Steam auth entry + callback
    games/[slug]/             Canonical game page
    profile/                  Collector profile and server actions
  components/
    csv-import-widget.tsx     Client-side CSV mapping UI
    sign-out-form.tsx         Session clear action
  lib/
    catalog.ts                Catalog resolution, sync, import logic
    assistant/                    Backlog scoring, AI summaries, and buy decisions
    hltb.ts                   HowLongToBeat best-effort completion-time search
    igdb.ts                   IGDB auth, search, and ranking
    prisma.ts                 Prisma client singleton
    session.ts                Signed cookie session helpers
    steam.ts                  Steam OpenID and Steam Web API integration
    utils.ts                  Formatting and normalization helpers
prisma/
  schema.prisma               Prisma schema
scripts/
  init-db.mjs                 SQLite bootstrap script
```

## Current Rough Edges

- The repository still contains starter-project leftovers that have not all been cleaned up.
- The current README was replaced from the default template, but surrounding contributor docs may still need tightening.
- ESLint currently reports warnings for raw `<img>` usage on catalog pages.
- There are uncommitted local changes in the repository.

## Linting

Run:

```bash
npm run lint
```

At the time of writing, lint passes with warnings only. The active warnings are the standard Next.js `no-img-element` warnings for image rendering.

## Next Steps

Likely next improvements for the product:

- replace raw image tags with `next/image` where appropriate
- add tests around catalog resolution and import behavior
- decide whether database initialization should stay custom or move fully to Prisma migrations
- document deployment and production environment expectations
- expand provider support beyond Steam
