// One-off migration: copy catalog + per-user data from the legacy SQLite
// database (prisma/dev.db) into the current PostgreSQL database (DATABASE_URL).
//
// Why this exists: the app was switched from SQLite to Postgres. `prisma db
// push` created the schema in Postgres but copied no rows, so the catalog
// (Game / GameProviderLink / UserGameEntry and related tables) still lives only
// in prisma/dev.db. This script copies those rows, preserving primary keys and
// relations.
//
// Reality forces exactly two value transforms (everything else is preserved):
//   1. userId remap — users re-registered after the switch, so the old SQLite
//      user ids no longer exist in Postgres. We map by verified identity.
//   2. Steam externalAccountId remap — Postgres already has a Steam
//      ExternalAccount with the same Steam id (unique [provider,
//      providerAccountId]), so the SQLite Steam account row is NOT inserted;
//      entries that referenced it point at the existing Postgres row instead.
//
// The migration is additive (it never updates or deletes existing Postgres
// rows) and runs inside a single transaction (all-or-nothing).
//
// Usage:
//   node scripts/migrate-sqlite-to-postgres.mjs --dry-run   # validate, no writes
//   node scripts/migrate-sqlite-to-postgres.mjs             # execute

import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import { Prisma, PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL && existsSync(".env")) {
  process.loadEnvFile(".env");
}

const DRY_RUN = process.argv.includes("--dry-run");
const SQLITE_PATH = "prisma/dev.db";

// --- Identity maps (verified by inspection) ----------------------------------
// Old SQLite user id -> current Postgres user id.
const USER_ID_MAP = {
  // Ludmila (Google: 105556002311701109167, ludmila.omlopes@gmail.com)
  cmqffls2r0000q0kgrfkll60f: "cmqk8s3yb0000kw045uauqgvd",
  // Steam-only login "ludmila.omlopes" -> Postgres "Player 3579"
  // (both Steam id 76561198321023579, no Google link)
  cmqauwpl10000q0cgzsqdtips: "cmq2gkkf20000q0lwih3wfwg6",
  // "Issue 18 QA" owns zero rows; included only so a stray reference would map
  // rather than abort. (No Postgres counterpart; never referenced in practice.)
};

// Old SQLite ExternalAccount id -> id to use in Postgres.
// Only the Steam account needs remapping (already present in Postgres).
const EA_ID_MAP = {
  cmqauwptr0002q0cg7gbpsbz3: "cmq2gkku70002q0lw5v5ojtv0",
};

// SQLite ExternalAccount rows to skip inserting (already exist in Postgres).
const EA_SKIP_INSERT = new Set(["cmqauwptr0002q0cg7gbpsbz3"]);

// Tables to migrate, in foreign-key dependency order. `User` is intentionally
// excluded (the 3 Postgres users already exist). Empty tables are skipped.
const MIGRATION_ORDER = [
  "ExternalAccount",
  "Game",
  "GameProviderLink",
  "UserGameEntry",
  "UserGameReview",
  "GameJournalEntry",
  "JournalMedia",
  "UserGameInsight",
  "AssistantRun",
  "PlayerProfile",
  "BetaTesterApplication",
  "ImportJob",
  "ImportRow",
];

const modelByName = new Map(
  Prisma.dmmf.datamodel.models.map((m) => [m.name, m]),
);
const accessor = (name) => name.charAt(0).toLowerCase() + name.slice(1);

function convertValue(field, raw) {
  if (raw === null || raw === undefined) return null;
  if (field.kind === "enum") return raw; // stored as TEXT, Prisma accepts string
  switch (field.type) {
    case "DateTime":
      // Prisma stores SQLite DateTime as epoch milliseconds (INTEGER).
      return typeof raw === "number"
        ? new Date(raw)
        : new Date(typeof raw === "bigint" ? Number(raw) : String(raw));
    case "Boolean":
      return Boolean(raw); // 0 / 1
    case "Json":
      return typeof raw === "string" ? JSON.parse(raw) : raw;
    case "Int":
    case "Float":
      return typeof raw === "bigint" ? Number(raw) : raw;
    default:
      return raw; // String, etc.
  }
}

function remapUserId(id) {
  if (id === null || id === undefined) return id;
  const mapped = USER_ID_MAP[id];
  if (!mapped) throw new Error(`Unmapped userId encountered: ${id}`);
  return mapped;
}

function buildRows(sqlite, modelName) {
  const model = modelByName.get(modelName);
  if (!model) throw new Error(`Unknown model ${modelName}`);

  // Columns that actually exist in the SQLite table (handles schema drift:
  // fields added after the SQLite db was last synced are simply omitted, so
  // Prisma applies their defaults).
  const sqliteCols = new Set(
    sqlite.prepare(`PRAGMA table_info("${modelName}")`).all().map((c) => c.name),
  );
  const fields = model.fields.filter(
    (f) =>
      (f.kind === "scalar" || f.kind === "enum") &&
      !f.isList &&
      sqliteCols.has(f.name),
  );

  const rawRows = sqlite.prepare(`SELECT * FROM "${modelName}"`).all();
  const rows = [];
  for (const raw of rawRows) {
    if (modelName === "ExternalAccount" && EA_SKIP_INSERT.has(raw.id)) continue;

    const data = {};
    for (const f of fields) data[f.name] = convertValue(f, raw[f.name]);

    if ("userId" in data) data.userId = remapUserId(data.userId);
    if ("reviewedById" in data) data.reviewedById = data.reviewedById
      ? remapUserId(data.reviewedById)
      : data.reviewedById;
    if ("externalAccountId" in data && data.externalAccountId) {
      data.externalAccountId =
        EA_ID_MAP[data.externalAccountId] ?? data.externalAccountId;
    }
    rows.push(data);
  }
  return rows;
}

async function main() {
  if (!existsSync(SQLITE_PATH)) {
    throw new Error(`SQLite source not found at ${SQLITE_PATH}`);
  }
  const sqlite = new DatabaseSync(SQLITE_PATH, { readOnly: true });
  const prisma = new PrismaClient();

  console.log(`\n=== Migration ${DRY_RUN ? "(DRY RUN)" : "(LIVE)"} ===\n`);

  // --- Preflight guards ------------------------------------------------------
  const [gameCount, gplCount, ugeCount] = await Promise.all([
    prisma.game.count(),
    prisma.gameProviderLink.count(),
    prisma.userGameEntry.count(),
  ]);
  if (gameCount || gplCount || ugeCount) {
    throw new Error(
      `Aborting: Postgres core tables are not empty ` +
        `(Game=${gameCount}, GameProviderLink=${gplCount}, UserGameEntry=${ugeCount}). ` +
        `This migration is meant to run once into an empty catalog.`,
    );
  }
  const targetUserIds = [...new Set(Object.values(USER_ID_MAP))];
  const foundUsers = await prisma.user.findMany({
    where: { id: { in: targetUserIds } },
    select: { id: true },
  });
  const foundUserIds = new Set(foundUsers.map((u) => u.id));
  for (const id of targetUserIds) {
    if (!foundUserIds.has(id)) {
      throw new Error(`Aborting: target Postgres user ${id} not found.`);
    }
  }
  const steamEa = await prisma.externalAccount.findUnique({
    where: { id: EA_ID_MAP.cmqauwptr0002q0cg7gbpsbz3 },
    select: { id: true, providerAccountId: true },
  });
  if (!steamEa || steamEa.providerAccountId !== "76561198321023579") {
    throw new Error(
      `Aborting: expected existing Postgres Steam ExternalAccount not found.`,
    );
  }
  console.log("Preflight OK: catalog empty, target users + Steam account present.\n");

  // --- Build all rows --------------------------------------------------------
  const plan = [];
  for (const modelName of MIGRATION_ORDER) {
    const rows = buildRows(sqlite, modelName);
    if (rows.length) plan.push({ modelName, rows });
    console.log(`${modelName}: ${rows.length} row(s) to insert`);
  }

  if (DRY_RUN) {
    console.log("\n--- Sample converted row per table ---");
    for (const { modelName, rows } of plan) {
      const sample = rows[0];
      const preview = {};
      for (const [k, v] of Object.entries(sample)) {
        preview[k] =
          v instanceof Date
            ? `Date(${v.toISOString()})`
            : typeof v === "object" && v !== null
              ? `${Array.isArray(v) ? "Array" : "Json"}(${JSON.stringify(v).slice(0, 60)}…)`
              : v;
      }
      console.log(`\n[${modelName}]`, JSON.stringify(preview, null, 2));
    }
    console.log("\nDRY RUN complete — no writes performed.");
    await prisma.$disconnect();
    sqlite.close();
    return;
  }

  // --- Execute (atomic) ------------------------------------------------------
  await prisma.$transaction(
    async (tx) => {
      for (const { modelName, rows } of plan) {
        const res = await tx[accessor(modelName)].createMany({ data: rows });
        console.log(`Inserted ${res.count} into ${modelName}`);
      }
    },
    { timeout: 120000, maxWait: 20000 },
  );

  // --- Verify ----------------------------------------------------------------
  console.log("\n=== Post-migration Postgres counts ===");
  const verify = {
    ExternalAccount: await prisma.externalAccount.count(),
    Game: await prisma.game.count(),
    GameProviderLink: await prisma.gameProviderLink.count(),
    UserGameEntry: await prisma.userGameEntry.count(),
    UserGameReview: await prisma.userGameReview.count(),
    GameJournalEntry: await prisma.gameJournalEntry.count(),
    UserGameInsight: await prisma.userGameInsight.count(),
    AssistantRun: await prisma.assistantRun.count(),
  };
  for (const [k, v] of Object.entries(verify)) console.log(`${k}: ${v}`);

  await prisma.$disconnect();
  sqlite.close();
  console.log("\nMigration complete.");
}

main().catch((err) => {
  console.error("\nMigration FAILED:", err);
  process.exit(1);
});
