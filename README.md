# filazo

filazo is a game library app built with Next.js 16, React 19, Prisma, and PostgreSQL.
It is designed around a canonical local game catalog that can absorb data from multiple sources:

- Steam account sign-in and owned library sync
- CSV imports for backlog and wishlist exports
- Photo imports for screenshots or photos of catalog pages/shelves
- PlayStation NPSSO-based sync for PS4/PS5 purchased games and played trophy titles
- PlayStation CSV imports for library and backlog data
- Xbox Microsoft account sign-in and achievement-history sync
- Xbox CSV imports for library and backlog data
- IGDB metadata enrichment for covers, release dates, platforms, screenshots, and ratings
- HowLongToBeat completion-time enrichment for main story, main + extras, and completionist estimates
- Metacritic metascore enrichment when Steam Store metadata exposes a score
- Cached upcoming-release signals for release-aware backlog recommendations
- Optional rule-based and AI-assisted backlog assistance
- Optional user review import, game journaling, and onboarding preferences

The current app already includes a landing page, a closed-registration modal sign-in flow, a Google beta tester application flow, an admin review area, a collector profile with a dedicated integrations area, Steam authentication, Steam sync, PlayStation library sync, Xbox authentication and achievement-history sync, CSV mapping/import, and per-game catalog pages.

## Stack

- Next.js 16 App Router
- React 19
- Prisma 6
- PostgreSQL
- Tailwind CSS 4
- JOSE-based signed cookie sessions

## Core Product Model

The app is centered on a canonical `Game` record.

- `Game` stores the normalized catalog entry plus shared IGDB, HLTB, Metacritic, and upcoming-release cache metadata
- `GameProviderLink` links a canonical game to an external provider ID like a Steam app ID
- `UserGameEntry` stores user ownership, wishlist state, playtime, dropped state, last played date, achievement progress (`completionPercent`), up to one optional current-playing slot (`currentPlayingSlot`), up to one optional playing-next queue slot (`playingNextSlot`), and a separate finished state (`finishedAt`/`finishedSource`) for a game; finished means the credits rolled, which is independent of 100% achievement completion
- `GameProviderLink` also caches the detected story-completion ("credits roll") achievement per provider (`storyAchievementId`, `storyAchievementName`, `storyAchievementSource`, `storyAchievementCheckedAt`)
- `UserGameInsight` stores per-game assistant signals such as untouched, sampled-dropped, wishlist risk, and release candidates
- `AssistantRun` stores each assistant refresh summary and optional AI output metadata
- `AiSettings` stores admin-configurable AI feature toggles, daily budget limits, model-call caps, token caps, and upload/recording limits
- `PlayerProfile` stores the AI-generated player profile (summary, preferences, patterns, internal recommendations) plus the agent's tool-call trace
- `UserGameReview` stores imported provider reviews tied to both a user entry and canonical game
- `GameJournalEntry` and `JournalMedia` store per-game journal notes, screenshots, voice-note metadata, transcripts, and generated recaps
- `ExternalAccount` stores connected provider accounts like Steam, PlayStation, and Xbox
- `BetaTesterApplication` stores Google-authenticated beta tester requests, approval status, admin justification, and the one-year access expiry for approved testers
- PlayStation refresh tokens are encrypted in `ExternalAccount.metadata`; NPSSO values are exchanged and then discarded
- `ImportJob` and `ImportRow` keep an audit trail of CSV and photo imports

This means multiple providers can eventually point to the same internal game instead of creating duplicate records.

## Features

- Modal sign-in for existing first-party email/password accounts and existing Google OAuth accounts
- Closed public registration with beta tester applications through Google login
- Admin-only beta review area for `ludmila.omlopes@gmail.com`, with approve/reject decisions and required justification
- English and Portuguese (Brazil) UI with a header language switcher
- Dedicated profile integrations area for connecting, syncing, and disconnecting external accounts
- Steam OpenID sign-in
- Steam owned games sync with playtime, last played date, and achievement-based completion percentages when Steam exposes the data
- PlayStation connection through NPSSO with sync for PS4/PS5 purchased games, played trophy titles, and trophy progress
- Xbox connection through Microsoft OAuth with sync for achievement-history titles, recent title history, and achievement progress
- CSV upload with in-browser column mapping for titles, status, playtime, completion percentage, notes, and external IDs
- Photo upload in Sources that uses AI vision, when configured, to extract visible games from catalog screenshots/photos and merge them into the canonical catalog
- PlayStation CSV mode that stores entries as PlayStation provider data and links mapped external IDs through `GameProviderLink`
- Xbox CSV mode that stores entries as Xbox provider data and links mapped external IDs through `GameProviderLink`
- IGDB best-match enrichment during imports and sync
- Best-effort HowLongToBeat enrichment during imports and sync
- Estimated time remaining for user entries when HLTB data and playtime or progress are available
- Finished-game detection that finds each game's story-completion achievement or trophy (Steam and PlayStation) and marks entries finished when it is unlocked, plus a manual "mark finished" toggle on game pages
- Manual controls on game pages to mark credits rolled or mark/restore dropped games; dropped and not-started games are hidden from the catalog by default unless the user includes them
- Manual game journal entries on canonical game pages with screenshot upload, audio upload, transcription, translated transcript storage, recap text, and achievement-aware progress notes
- Best-effort Steam public review import into per-user review records; PlayStation and Xbox reviews are treated as unsupported by the current source flows
- Optional onboarding preferences for play frequency, usual play windows, current platforms, and source guidance
- Best-effort Metacritic score capture for Steam-linked catalog records
- Collector profile page with overview, current-playing picks, and owned/wishlist sections
- Canonical game detail pages
- Assistant tab with backlog friction insights, play-next picks, release candidates, and buy-decision guidance

## Requirements

- Node.js 22.5+
- npm
- A PostgreSQL database for catalog and account data

Optional, depending on what you want to use:

- Steam Web API key for owned library sync
- Google OAuth credentials for existing Google login and beta tester access requests
- Resend credentials for automatic beta approval emails
- Microsoft OAuth app credentials for Xbox account sync
- IGDB client credentials for metadata enrichment

PlayStation and Xbox imports use CSV files and do not require credentials.
Xbox account sync requires Microsoft OAuth credentials and uses Xbox achievement/title-history endpoints.
HowLongToBeat enrichment uses an unofficial website-backed lookup and does not require credentials.
Metacritic scores are collected only when public Steam Store app metadata includes a metascore and URL.

## Environment Variables

Copy `.env.example` to `.env` and fill in what you need.

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/filazo?schema=public"
APP_URL="http://localhost:3001"
AUTH_SECRET="replace-with-a-long-random-string"

# Steam
STEAM_API_KEY=""

# Google login
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# Xbox / Microsoft OAuth
XBOX_CLIENT_ID=""
XBOX_CLIENT_SECRET=""

# IGDB / Twitch
IGDB_CLIENT_ID=""
IGDB_CLIENT_SECRET=""

# Transactional email for beta approvals
RESEND_API_KEY=""
BETA_APPROVAL_FROM_EMAIL=""
BETA_APPROVAL_REPLY_TO=""
BETA_DISCORD_INVITE_URL=""

# Optional AI assistant
# OPENAI_BASE_URL points OpenAI-compatible chat/responses calls at any gateway.
# Leave unset for OpenAI, or use a gateway like OpenRouter for more model
# options: set OPENAI_BASE_URL="https://openrouter.ai/api/v1", an OpenRouter key
# in OPENAI_API_KEY, and a routed model such as OPENAI_MODEL="anthropic/claude-opus-4.8".
OPENAI_API_KEY=""
OPENAI_BASE_URL=""
OPENAI_MODEL="gpt-5.4-mini"
# Initial central AI budget defaults. After `/admin` saves AI settings, the
# database values become the runtime source of truth.
AI_USER_DAILY_LIMIT="20"
AI_GLOBAL_DAILY_LIMIT="100"
# Voice-journal transcription always uses OpenAI directly (no gateway exposes
# this endpoint). When OPENAI_API_KEY holds a non-OpenAI gateway key, set a real
# OpenAI key here to keep transcription working.
OPENAI_TRANSCRIPTION_API_KEY=""
OPENAI_TRANSCRIPTION_MODEL="gpt-4o-mini-transcribe"
```

Notes:

- `AUTH_SECRET` should be a long random string in any non-local environment.
- `DATABASE_URL` is required for catalog features and must point to a PostgreSQL database.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` enable the Google button in the login popup and the beta access login. Add both `${APP_URL}/api/auth/google/callback` and `${APP_URL}/api/auth/youtube/callback` as authorized redirect URIs in Google Cloud. The beta access flow uses Google identity scopes only (`openid email profile`), which avoids the blocked-app behavior triggered by unnecessary YouTube scopes.
- `RESEND_API_KEY` and `BETA_APPROVAL_FROM_EMAIL` enable automatic approval emails when an admin approves a beta tester. `BETA_APPROVAL_REPLY_TO` is optional. `BETA_DISCORD_INVITE_URL` adds the beta Discord invite to the approval email. If Resend is not configured, approvals still succeed and the app logs that the email was skipped.
- `STEAM_API_KEY` is required for owned library sync. Steam sign-in itself uses OpenID.
- PlayStation sync does not require an app key. Users provide an NPSSO token in the profile page; the app exchanges it for PlayStation API tokens, stores encrypted refresh/access tokens, and does not store the NPSSO.
- `XBOX_CLIENT_ID` is required for Xbox account sync. Register a Microsoft OAuth app for personal Microsoft accounts and add `${APP_URL}/api/auth/xbox/callback` as a web redirect URI. `XBOX_CLIENT_SECRET` is recommended for web app token exchange.
- Xbox sync stores encrypted Microsoft refresh/access tokens in `ExternalAccount.metadata`. It imports Xbox achievement-history and recent-title-history records, not a guaranteed complete ownership library; Xbox CSV remains the fallback for owned games with no achievement activity.
- IGDB enrichment is optional. If IGDB credentials are missing, the app still works, but imported/synced games stay with local metadata only and assistant refreshes skip upcoming-release cache checks.
- HowLongToBeat enrichment is optional and best-effort. If the website-backed search is unavailable, imports and Steam sync continue without completion-time estimates.
- Metacritic enrichment is optional and best-effort. If Steam Store app metadata does not expose a Metacritic score, the canonical game keeps an empty metascore.
- The Assistant tab works without AI. If `OPENAI_API_KEY` is set, the app can use OpenAI's Responses API to recommend three low-friction play-next picks and turn rule-based insights into short explanations. Only library summaries, selected game metadata, progress/playtime signals, source/provider labels, and rule outputs are sent.
- Photo catalog import and voice transcription also use AI when configured and enabled in the admin settings. By default, photo import accepts up to 2 images of 4 MB each and uses vision-capable Responses API calls to extract visible titles. Voice journal uploads default to 10 MB; browser recordings default to 3 minutes. These limits are editable in `/admin`. Transcription uses `OPENAI_TRANSCRIPTION_MODEL`, while transcript translation uses `OPENAI_MODEL` only when a translation is still needed. Without the API key, manual journaling and normal imports still work; photo extraction is recorded as skipped in the import audit.
- The model provider is configurable. By default these calls go to OpenAI, but `OPENAI_BASE_URL` points the chat and Responses API calls at any OpenAI-compatible gateway — for example OpenRouter (`https://openrouter.ai/api/v1`) for access to Anthropic, Google, and other models through one key. Set `OPENAI_API_KEY` to the gateway key and `OPENAI_MODEL` to a routed id such as `anthropic/claude-opus-4.8`. The library chat uses the Chat Completions endpoint for the broadest gateway compatibility; the play-next, insight, photo, story-completion, and player-profile features use the Responses API, so prefer models and gateways that support Responses-style tool calling and `json_schema` structured output. Voice-journal transcription is the one exception: it always calls OpenAI directly (no gateway exposes a transcription endpoint), so set `OPENAI_TRANSCRIPTION_API_KEY` to a real OpenAI key when `OPENAI_API_KEY` holds a gateway key.
- Uploaded journal media and photo-import source images are stored under `public/uploads/` in local development, with only file references and metadata persisted in PostgreSQL. Use durable object storage before relying on this for production deployments.
- The Overview tab includes an agentic player profile. When `OPENAI_API_KEY` is set and player profile AI is enabled in `/admin`, an agent loop gives the model read-only tools over the user's own catalog (`get_library_overview`, `list_games`, `get_player_feedback`, `get_genre_stats`); it defaults to 3 budgeted model calls per generation and then submits a structured profile (`submit_player_profile`) with preferred genres, play styles, behavior patterns, and recommendations drawn only from games already in the library. Tool payloads are minimized projections of `UserGameEntry` and `Game` metadata; no secrets, tokens, or provider account IDs are sent. Without the API key or when disabled, profile generation fails with a clear message while the rest of the app keeps working.
- The Assistant tab also includes a streaming library chat built on the Vercel AI SDK (`/api/assistant/chat`). It reuses the same read-only tool layer (`src/lib/assistant/library-tools.ts`) as the profile agent, so answers come from live lookups into the user's own catalog. It requires `OPENAI_API_KEY` and the admin chat toggle, and returns a clear 503 message without either. By default, each chat exchange reserves 3 AI budget units before streaming, is capped at 3 tool/model steps and 700 output tokens, and is rejected with a 429 once the quota is spent. Those chat caps are editable in `/admin`.
- AI calls are app-gated before contacting the provider. Runtime gates are configured in `/admin` and stored in `AiSettings`; `AI_USER_DAILY_LIMIT` and `AI_GLOBAL_DAILY_LIMIT` are only initial defaults before an admin save exists. Budget units are counted across assistant refreshes, chat, player profile generation, photo import, voice transcription/translation, and story-completion classification. Direct Responses/transcription calls reserve 1 unit each by default; chat defaults to 3 units because tool use can require multiple model steps. The Assistant refresh still reuses unchanged OpenAI recommendations and applies a 10-minute per-user refresh cooldown. When a gate blocks AI, deterministic fallbacks or clear unavailable states are used.

## Getting Started

1. Install dependencies.

```bash
npm install
```

2. Create `.env` from `.env.example`.

3. Initialize the PostgreSQL database schema.

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

Open `http://localhost:3001`.

## Localization

- filazo currently ships with `en` and `pt-BR` UI copy.
- The header language switcher stores the selected locale in the `filazo-locale` cookie.
- When that cookie is missing, the app falls back to the request `Accept-Language` header and prefers `pt-BR` for Portuguese requests.
- Routes do not use locale prefixes. `/`, `/profile`, `/tonight`, and `/games/[slug]` stay the same in every language.

## Database Notes

This project uses PostgreSQL through Prisma and includes two database-related pieces:

- [prisma/schema.prisma](./prisma/schema.prisma) as the source Prisma schema
- [scripts/init-db.mjs](./scripts/init-db.mjs) as a guard around `prisma db push`

Current scripts:

- `npm run db:init`: validates `DATABASE_URL` and applies the Prisma schema with `prisma db push`
- `npm run db:push`: same as `db:init`
- `npm run db:generate`: generates Prisma Client

## Vercel Deployment

The public shell can render without a database, but Steam sign-in, profile data,
CSV import, and catalog stats require a reachable production database.

Vercel serverless deployments require a reachable managed PostgreSQL database.
Create one through Vercel Postgres, Neon, Supabase, Railway, or another managed
PostgreSQL provider, set `DATABASE_URL`, run the schema setup for that database,
and set these environment variables:

```env
APP_URL="https://your-vercel-domain.vercel.app"
AUTH_SECRET="generate-a-long-random-secret"
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/filazo?schema=public"
```

Optional integrations still degrade independently: missing IGDB credentials only
skip metadata enrichment, and missing `STEAM_API_KEY` only blocks owned-library
sync after Steam sign-in.

## Available Scripts

- `npm run dev`: start the Next dev server
- `npm run build`: build for production
- `npm run start`: start the production server
- `npm run lint`: run ESLint
- `npm run db:init`: initialize the PostgreSQL schema
- `npm run db:push`: currently same as `db:init`
- `npm run db:generate`: generate Prisma Client

## How the App Works

### Steam flow

1. The user starts from `/login` or directly at `/api/auth/steam`.
2. The app redirects to Steam OpenID.
3. Steam returns to `/api/auth/steam/callback`.
4. The callback verifies the OpenID response, creates or reuses a local user, stores the Steam account, and sets a signed session cookie.
5. From the profile integrations tab, the user can run a Steam sync to fetch owned games and attach them to canonical catalog entries.

### PlayStation flow

1. The user signs in to PlayStation in a browser and retrieves their NPSSO token.
2. The profile page exchanges the NPSSO for PlayStation access and refresh tokens through `psn-api`.
3. The app stores encrypted PlayStation API tokens in `ExternalAccount.metadata` and discards the NPSSO.
4. From the profile integrations tab, the user can sync PS4/PS5 purchased games through `getPurchasedGames` and played trophy titles through `getUserTitles`.
5. Each title is attached to a canonical `Game` with `PLAYSTATION` `GameProviderLink` records keyed by available IDs such as `titleId`, `productId`, `conceptId`, `entitlementId`, and `npCommunicationId`.
6. Trophy progress is stored as `UserGameEntry.completionPercent` when PSN exposes it.

### Xbox flow

1. The user starts from `/login`, the profile integrations tab, or directly at `/api/auth/xbox`.
2. The app redirects to Microsoft OAuth with `Xboxlive.signin` and `Xboxlive.offline_access` scopes.
3. Microsoft returns to `/api/auth/xbox/callback`.
4. The callback exchanges the authorization code for Microsoft OAuth tokens, then exchanges those for Xbox Live user and XSTS tokens.
5. The app stores encrypted Microsoft OAuth tokens in `ExternalAccount.metadata`; short-lived Xbox Live/XSTS tokens are regenerated during sync.
6. From the profile integrations tab, the user can sync Xbox achievement-history titles and recent title history.
7. Each title is attached to a canonical `Game` with `XBOX` `GameProviderLink` records keyed by available IDs such as `titleId`, `scid`, and `pfn`.
8. Achievement progress is stored as `UserGameEntry.completionPercent` when Xbox exposes enough achievement or gamerscore data.

### CSV, PlayStation, and Xbox import flow

1. The user uploads a CSV on the profile page.
2. The browser parses the file and shows a source selector plus column-mapping UI.
3. A server action receives the raw CSV plus selected mappings.
4. Each row is normalized into a canonical game resolution attempt.
5. When PlayStation CSV is selected, `UserGameEntry.provider` is set to `PLAYSTATION`, the platform defaults to PlayStation when no platform column is mapped, and any mapped external ID is stored as a PlayStation `GameProviderLink`.
6. When Xbox CSV is selected, `UserGameEntry.provider` is set to `XBOX`, the platform defaults to Xbox when no platform column is mapped, and any mapped external ID is stored as an Xbox `GameProviderLink`.
7. Import results are recorded in `ImportJob` and `ImportRow`.

### Account and integration management

1. Logged-out users open the login popup from the header, home page, or `/login`.
2. Existing users can enter a first-party filazo account with email/password or continue with an already known Google account.
3. New public registrations are closed. New beta candidates use `/beta`, sign in with Google, and submit their name plus played platforms, including an open retrogames field.
4. The admin area at `/admin` is restricted to `ludmila.omlopes@gmail.com`. It can approve or reject beta testers with a required justification, send an approval email when Resend is configured, and configure global AI feature toggles, budgets, and per-feature limits.
5. Approved beta testers receive full platform access for 1 year from approval.
6. Logged-in users manage Steam, PlayStation, and Xbox from `/profile?tab=integrations`.
7. Disconnecting a provider deletes the `ExternalAccount` row and removes stored external credentials or account links.
8. Existing `UserGameEntry` records remain in the user's catalog. Their provider/source history remains intact, and the nullable `externalAccountId` relation is cleared by the database relation.

### Catalog resolution

Whenever a game comes from Steam, PlayStation sync, Xbox sync, generic CSV, PlayStation CSV, or Xbox CSV:

1. The app checks for an existing provider link when a provider ID is available.
2. It checks for an existing game by normalized title.
3. It tries to enrich the record with IGDB and HowLongToBeat.
4. It creates or updates the canonical `Game`.
5. It links external provider IDs, including HLTB IDs when available, through `GameProviderLink`.
6. It stores the user-facing entry in `UserGameEntry`.

Steam sync stores `lastPlayedAt` from Steam's `rtime_last_played` field when Steam returns it. It also tries to calculate `completionPercent` from achievements by comparing unlocked achievements to the total achievements returned for each app. Both are best-effort: games without last-played data or Steam achievements, private or blocked stats, and temporary API failures are left untracked.

HowLongToBeat stores completion estimates on the canonical `Game` as minutes and links the HLTB game ID through `GameProviderLink`. HLTB does not expose an official public API, so failures or search misses are ignored instead of blocking catalog resolution. User entries estimate remaining time from the default HLTB target, preferring main + extras, then main story, then completionist; completion percentage is used first, otherwise recorded playtime is subtracted.

Metacritic stores the critic metascore on the canonical `Game` and links the Metacritic URL through `GameProviderLink` when Steam Store metadata provides it. This avoids scraping Metacritic directly and keeps missing scores non-blocking.

Upcoming-release checks run during assistant refreshes for stale finished-game history. Results are cached on the canonical `Game` as provider-neutral release metadata plus `upcomingReleasesCheckedAt`, so later assistant runs can reuse the global catalog data instead of fetching repeatedly. Missing IGDB credentials or failed lookups leave the assistant on deterministic local signals.

### Reviews, journals, and photo imports

Steam public recommendations can be imported from the Sources tab after Steam is connected. Imported reviews are matched back to Steam-linked canonical games and stored as `UserGameReview` records. PlayStation and Xbox review import is not supported by the current provider flows and is shown as such in the UI.

Game pages include a journal timeline for the signed-in user's own catalog entry. Manual notes, uploaded screenshots, uploaded audio, transcripts, translated transcripts, generated mechanics recaps, and achievement-aware summaries are stored against `GameJournalEntry` and `JournalMedia` records.

Photo import lives in the Sources tab. It creates an `ImportJob`, stores the uploaded source image under `public/uploads/imports/`, asks the configured AI model to extract visible game candidates, skips uncertain candidates for audit review, and resolves imported titles through the existing canonical catalog flow before updating or creating `UserGameEntry` records.

### Finished vs 100%

`completionPercent` is achievement/trophy progress and is never treated as story completion. A game counts as finished when its credits roll: either the user marks the entry finished, a CSV import says so, or detection finds the unlocked story-completion achievement. Detection ("Detect finished games" on the profile Games tab) fetches each game's achievement list (Steam schema or PSN trophy list), tries keyword heuristics first, and only calls AI for ambiguous games when `OPENAI_API_KEY`, admin settings, and AI budget allow it. A detection run defaults to at most 10 story-classification AI calls, and successful/none results are cached on `GameProviderLink`. Everything is best-effort: games without a detectable story achievement, missing API keys, spent AI budget, disabled AI, or provider failures are skipped. Xbox detection is not supported yet. The assistant also raises a low-confidence "likely finished" signal when logged playtime exceeds ~90% of the HLTB main story and the game has gone idle, suggesting a manual confirmation rather than auto-marking.

### Assistant flow

1. The user opens `/profile?tab=assistant`.
2. A server action refreshes deterministic insights from `UserGameEntry` data such as status, playtime, last played date, completion, favorites, and genres.
3. Insights are stored in `UserGameInsight`; each `AssistantRun` keeps a compact audit trail of the input summary and output summary.
4. Before calling OpenAI, the app reuses the latest OpenAI recommendations when the relevant catalog context has not changed. Otherwise it enforces a 10-minute per-user refresh cooldown plus the central AI budget configured in `/admin`.
5. If OpenAI credentials are configured and the AI budget allows the refresh, the app asks for structured play-next recommendations from the user's catalog and a structured explanation. If the request fails, credentials are missing, or a limit is reached, deterministic fallback picks and text are used.
6. The buy-decision helper compares a candidate title against owned/wishlist/backlog patterns and returns buy, wait, wishlist, or skip guidance.

## Project Structure

```text
src/
  app/
    api/auth/steam/           Steam auth entry + callback
    api/auth/xbox/            Xbox Microsoft OAuth entry + callback
    games/[slug]/             Canonical game page
    profile/                  Collector profile and server actions
  components/
    csv-import-widget.tsx     Client-side CSV mapping UI
    sign-out-form.tsx         Session clear action
  lib/
    catalog.ts                Catalog resolution, sync, import logic
    assistant/                    Backlog scoring, AI summaries, and buy decisions
    hltb.ts                   HowLongToBeat best-effort completion-time search
    metacritic.ts             Metacritic score lookup via Steam Store metadata
    igdb.ts                   IGDB auth, search, and ranking
    playstation.ts            PlayStation NPSSO token exchange and library sync
    prisma.ts                 Prisma client singleton
    session.ts                Signed cookie session helpers
    steam.ts                  Steam OpenID and Steam Web API integration
    xbox.ts                   Xbox OAuth, profile, achievement history, and title history integration
    utils.ts                  Formatting and normalization helpers
prisma/
  schema.prisma               Prisma schema
scripts/
  init-db.mjs                 Prisma database bootstrap wrapper
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
