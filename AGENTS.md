<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes, APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Repository Guidance

## Product Definition

filazo is a game library app built around a canonical internal catalog.
It currently merges data from:

- Steam sign-in and owned game sync
- CSV imports from backlog or wishlist tools
- IGDB metadata enrichment

The core architectural rule is: external providers should attach to one internal `Game` record whenever they refer to the same title.

## Architecture Rules

- Treat `Game` as the canonical game entity.
- Treat `GameProviderLink` as the mapping layer between external provider IDs and canonical games.
- Treat `UserGameEntry` as per-user state such as ownership, wishlist, backlog, or playtime.
- Preserve normalization logic in `src/lib/catalog.ts` and `src/lib/utils.ts` when adding providers or changing import behavior.
- Do not introduce provider-specific shortcuts that bypass canonical game resolution.
- Avoid creating duplicate game rows when the same game can be matched by provider ID, IGDB ID, or normalized title.

## Main App Areas

- `src/app/page.tsx`: landing page
- `src/app/profile/page.tsx`: collector profile and import/sync UI
- `src/app/profile/actions.ts`: server actions for Steam sync and CSV import
- `src/app/games/[slug]/page.tsx`: canonical game detail page
- `src/app/api/auth/steam/*`: Steam auth flow
- `src/lib/catalog.ts`: main business logic for catalog resolution, sync, imports, and queries
- `src/lib/steam.ts`: Steam OpenID and Steam Web API integration
- `src/lib/igdb.ts`: IGDB auth, search, ranking, and metadata mapping
- `prisma/schema.prisma`: data model
- `scripts/init-db.mjs`: direct SQLite bootstrap script

## Next.js Rules For This Repo

- This is an App Router project. Do not introduce Pages Router patterns.
- Prefer Server Components by default. Use client components only when browser APIs or client interactivity are required.
- Use server actions for mutations when that matches the existing flow.
- Before changing Next.js conventions or APIs, read the relevant local docs under `node_modules/next/dist/docs/01-app/`.
- Keep route handlers and server actions aligned with current Next.js 16 behavior rather than older training-era patterns.

## Data And Database Rules

- Local development uses SQLite.
- Prisma schema lives in `prisma/schema.prisma`.
- Database bootstrap is currently handled by `scripts/init-db.mjs`.
- `npm run db:push` currently runs the custom bootstrap script, not `prisma db push`.
- If you change the data model, keep `prisma/schema.prisma`, `scripts/init-db.mjs`, and the README in sync.

## External Integration Rules

### Steam

- Steam sign-in uses OpenID.
- Owned library sync requires `STEAM_API_KEY`.
- Auth entry is `/api/auth/steam`.
- Callback is `/api/auth/steam/callback`.
- Steam failures should degrade clearly and produce actionable user-facing errors.

### IGDB

- IGDB enrichment is optional.
- If `IGDB_CLIENT_ID` or `IGDB_CLIENT_SECRET` is missing, app behavior should still work without metadata enrichment.
- Keep enrichment logic best-effort and avoid breaking imports or sync when IGDB is unavailable.

## UI And Product Constraints

- Preserve the existing visual direction unless the task is explicitly a redesign.
- Do not casually replace the current brutalist/editorial styling with generic dashboard UI.
- Keep source syncing, CSV import, and manual game add flows in the Sources tab. Do not repeat source syncing flows on the profile Home tab.
- Do not expose IGDB as a user-facing feature name. Treat it as the internal metadata/search provider and use plain product language such as "game search" or "metadata".
- When extending features, prefer fitting them into the current canonical catalog model instead of adding isolated one-off screens or tables.

## Editing Guidance

- Check existing uncommitted changes before making edits.
- Do not remove the canonical resolution flow in `src/lib/catalog.ts` unless the task explicitly calls for a redesign.
- Be careful when changing import behavior because `ImportJob` and `ImportRow` are part of the audit trail.
- If adding a new provider, follow the existing adapter pattern in `src/lib/providers/contracts.ts`.
- Keep environment variables documented in `.env.example` and `README.md`.

## Verification Expectations

- Run `npm run lint` after meaningful code changes.
- Mention any warnings you leave in place, especially `next/image` related warnings.
- If you cannot test Steam or IGDB flows because API keys are missing, say so explicitly.
- If a change affects the schema or setup flow, update `README.md`.

## Good First Checks For Agents

Before making substantial changes:

1. Read `package.json`.
2. Read `prisma/schema.prisma`.
3. Read `src/lib/catalog.ts`.
4. Read the relevant Next.js local docs in `node_modules/next/dist/docs/01-app/` for framework-level changes.
5. Check `git status --short` so you do not trample existing work.
