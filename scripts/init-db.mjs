import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

if (!process.env.DATABASE_URL && existsSync(".env")) {
  process.loadEnvFile(".env");
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is required before initializing the database.");
  process.exit(1);
}

if (databaseUrl.startsWith("file:")) {
  console.error(
    "DATABASE_URL must point to a PostgreSQL database, for example postgresql://user:password@host:5432/database.",
  );
  process.exit(1);
}

// Existing libraries must be consolidated before db push can add platform identity.
// This is an explicit maintenance command; preview builds must not run it.
const migration = spawnSync(process.execPath, ["--import", "tsx", "scripts/apply-library-status-migration.ts"], {
  cwd: process.cwd(), env: process.env, stdio: "inherit", windowsHide: true,
});
if (migration.error || migration.status !== 0) process.exit(migration.status ?? 1);

// Includes account plans (existing/new users default to FREE), sync checkpoints/incidents, system feedback comments, provider links and metadata jobs. This is schema
// bootstrap only: workers require a normally generated Prisma client too.
// Deployments separately run db:check before building; this bootstrap also
// includes Game completion structure, Stripe billing tables, and the current provider enum values.
// Includes calendar observations, persisted forecasts, daily refresh limits,
// manual sessions, cited release dates and personal release subscriptions.
// UserGamePlayDate preserves only provider-confirmed first/last play dates.
// Also creates UserDailyActivity and PlatformError for the administrator dashboard,
// plus the public GameMarketplaceSnapshot cache for game-page store lookups.
// GameSteamReviewSnapshot stores the bounded, public Steam review cache for game pages,
// with separate rows for each supported platform language.
// AbuseLimitBucket holds atomic, expiring abuse counters with HMAC identifiers.
const result = spawnSync("npx", ["prisma", "db", "push", "--skip-generate"], {
  cwd: process.cwd(),
  env: process.env,
  shell: process.platform === "win32",
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
