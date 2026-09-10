import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import nextEnv from "@next/env";
import { PrismaClient } from "@prisma/client";

nextEnv.loadEnvConfig(process.cwd(), true);
const url = new URL(process.env.DATABASE_URL);
if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error("PostgreSQL is required.");
const schema = `steam_sync_test_${randomBytes(8).toString("hex")}`;
url.searchParams.set("schema", schema);
const env = {
  ...process.env, DATABASE_URL: url.toString(), NODE_ENV: "test", VERCEL_ENV: "test",
  IGDB_CLIENT_ID: "", IGDB_CLIENT_SECRET: "", PLATFORM_SYNC_ENABLED: "false",
};
const db = new PrismaClient({ datasourceUrl: url.toString() });
try {
  // Schema isolation is mandatory: no fixtures or migrations touch public data.
  const setup = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "db", "push", "--skip-generate"], {
    env, encoding: "utf8", windowsHide: true,
  });
  if (setup.status !== 0) throw new Error(`Could not initialize isolated test schema (exit ${setup.status}).`);
  console.log("Created isolated PostgreSQL schema for Steam queue checks.");
  const check = spawnSync(process.execPath, ["--import", "tsx", "scripts/qa/steam-sync-check.ts"], {
    env, stdio: "inherit", windowsHide: true,
  });
  process.exitCode = check.status ?? 1;
} finally {
  if (!/^steam_sync_test_[a-f0-9]{16}$/.test(schema)) throw new Error("Unsafe schema name.");
  await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await db.$disconnect();
  console.log("Removed isolated PostgreSQL test schema.");
}
