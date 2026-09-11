import { Prisma, PrismaClient } from "@prisma/client";
import { existsSync } from "node:fs";
import { checkDatabaseSchema, shouldCheckDatabase } from "./database-schema-check.mjs";

if (!process.env.DATABASE_URL && existsSync(".env")) process.loadEnvFile(".env");
let prisma;
try {
  if (shouldCheckDatabase(process.env)) {
    const url = new URL(process.env.DATABASE_URL);
    prisma = new PrismaClient({ log: [] });
    await checkDatabaseSchema(prisma, Prisma.dmmf.datamodel, url.searchParams.get("schema") || "public");
    console.log("Database schema is compatible with this application build.");
  } else {
    console.log("Database check skipped for offline local/CI build (no DATABASE_URL).");
  }
} catch {
  // Keep connection strings and raw provider errors out of build logs.
  console.error("Deployment blocked: database unavailable or schema incompatible. Apply the reviewed migrations to this environment and rerun the build.");
  process.exitCode = 1;
} finally {
  await prisma?.$disconnect();
}
