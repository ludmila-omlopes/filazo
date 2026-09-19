import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import { migrateLibraryStatus } from "./library-status-migration";

loadEnvConfig(process.cwd());
const url = new URL(process.env.DATABASE_URL!);
if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error("PostgreSQL is required.");
if (url.hostname.endsWith(".neon.tech")) url.hostname = url.hostname.replace("-pooler.", ".");
const db = new PrismaClient({ datasourceUrl: url.toString(), log: [] });
async function main() {
  try {
    console.log(await migrateLibraryStatus(db, url.searchParams.get("schema") || "public"));
  } catch {
    console.error("Library status migration failed and was rolled back. Keep the previous release paused and inspect the migration before retrying.");
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}
void main();
