import { existsSync, readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL && existsSync(".env")) process.loadEnvFile(".env");
const databaseUrl = new URL(process.env.DATABASE_URL);
if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol)) throw new Error("PostgreSQL is required.");
const schema = databaseUrl.searchParams.get("schema") || "public";
const sql = readFileSync(
  new URL("../../prisma/migrations/20260918170000_repair_sync_incident_feedback_owner/migration.sql", import.meta.url),
  "utf8",
);
const db = new PrismaClient();

try {
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('search_path', ${`"${schema.replaceAll('"', '""')}"`}, true)`;
    await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;
    for (const statement of sql.split(";").map((part) => part.trim()).filter(Boolean)) {
      await tx.$executeRawUnsafe(statement);
    }
  }, { timeout: 30_000 });
  console.log("Applied sync-monitor feedback-owner migration.");
} catch {
  console.error("Sync-monitor migration failed; deployment must not proceed.");
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
