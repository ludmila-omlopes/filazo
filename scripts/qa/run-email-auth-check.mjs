import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

// Explicit disposable local database only. Never load an application .env file.
const rawUrl = process.env.EMAIL_AUTH_QA_DATABASE_URL;
if (!rawUrl) throw new Error("Set EMAIL_AUTH_QA_DATABASE_URL to a disposable local PostgreSQL instance.");
const url = new URL(rawUrl);
if (!["postgres:", "postgresql:"].includes(url.protocol) ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
  throw new Error("Email auth QA requires a disposable local PostgreSQL instance.");
}
const schema = `email_auth_test_${randomBytes(8).toString("hex")}`;
url.searchParams.set("schema", schema);
const db = new PrismaClient({ datasourceUrl: url.toString() });
const env = {
  ...process.env, DATABASE_URL: url.toString(), NODE_ENV: "test",
  RESEND_API_KEY: "", IGDB_CLIENT_ID: "", IGDB_CLIENT_SECRET: "",
  GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "", PLATFORM_SYNC_ENABLED: "false",
};
try {
  await db.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  const setup = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "db", "push", "--skip-generate"], { env, encoding: "utf8", windowsHide: true });
  if (setup.status !== 0) throw new Error(`Could not initialize email auth QA schema (exit ${setup.status}).`);
  console.log("Created isolated local PostgreSQL email auth schema.");
  const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/qa/email-auth-check.ts"], { env, stdio: "inherit", windowsHide: true });
  process.exitCode = result.status ?? 1;
} finally {
  if (!/^email_auth_test_[a-f0-9]{16}$/.test(schema)) throw new Error("Unsafe QA schema.");
  await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await db.$disconnect();
  console.log("Removed isolated email auth QA schema.");
}
