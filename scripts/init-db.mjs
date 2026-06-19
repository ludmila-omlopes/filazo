import { spawnSync } from "node:child_process";

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

const result = spawnSync("npx", ["prisma", "db", "push"], {
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
