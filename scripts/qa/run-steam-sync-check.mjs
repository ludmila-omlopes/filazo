import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import nextEnv from "@next/env";
import { Prisma, PrismaClient } from "@prisma/client";
import { checkDatabaseSchema } from "../database-schema-check.mjs";

nextEnv.loadEnvConfig(process.cwd(), true);
const url = new URL(process.env.DATABASE_URL);
if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error("PostgreSQL is required.");
// Schema DDL needs session continuity; Neon transaction pooling can lose search_path.
if (url.hostname.endsWith(".neon.tech")) url.hostname = url.hostname.replace("-pooler.", ".");
const schema = `steam_sync_test_${randomBytes(8).toString("hex")}`;
url.searchParams.set("schema", schema);
const env = {
  ...process.env, DATABASE_URL: url.toString(), NODE_ENV: "test", VERCEL_ENV: "test",
  IGDB_CLIENT_ID: "", IGDB_CLIENT_SECRET: "", PLATFORM_SYNC_ENABLED: "false",
  RESEND_API_KEY: "",
};
const db = new PrismaClient({ datasourceUrl: url.toString() });
try {
  // Schema isolation is mandatory: no fixtures or migrations touch public data.
  await db.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  const setup = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "db", "push", "--skip-generate"], {
    env, encoding: "utf8", windowsHide: true,
  });
  if (setup.status !== 0) {
    const diagnostic = `${setup.stderr ?? ""}\n${setup.stdout ?? ""}`
      .replaceAll(env.DATABASE_URL, "[test database]")
      .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[database URL]");
    throw new Error(`Could not initialize isolated test schema (exit ${setup.status}). ${diagnostic}`);
  }
  console.log("Created isolated PostgreSQL schema for Steam queue checks.");
  await checkDatabaseSchema(db, Prisma.dmmf.datamodel, schema);
  console.log("PASS deployment schema guard against isolated PostgreSQL.");
  const check = spawnSync(process.execPath, ["--import", "tsx", process.argv[2] ?? "scripts/qa/steam-sync-check.ts"], {
    env, stdio: "inherit", windowsHide: true,
  });
  process.exitCode = check.status ?? 1;
} finally {
  if (!/^steam_sync_test_[a-f0-9]{16}$/.test(schema)) throw new Error("Unsafe schema name.");
  await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await db.$disconnect();
  console.log("Removed isolated PostgreSQL test schema.");
}
