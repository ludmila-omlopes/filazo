import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { applyPlatformRepair, capturePlatformRepair, platformRepairHash, validatePlatformRepair, type PlatformRepairPlan } from "./library-platform-repair";

loadEnvConfig(process.cwd(), true);
const db = new PrismaClient();
async function main() {
  const path = process.argv.find(arg => arg.startsWith("--plan="))?.slice(7);
  if (!path) throw new Error("Use --plan=<private JSON file> with userId and pairs [{ duplicateId, survivorId }]. Dry run unless --apply.");
  const plan = JSON.parse(await readFile(path, "utf8")) as PlatformRepairPlan;
  const snapshot = await capturePlatformRepair(db, plan);
  validatePlatformRepair(snapshot, plan);
  console.log(JSON.stringify({ pairs: plan.pairs.length, presentDuplicates: plan.pairs.filter(p => snapshot.entries.some(e => e.id === p.duplicateId)).length, mode: process.argv.includes("--apply") ? "apply" : "dry-run" }));
  if (!process.argv.includes("--apply")) return;
  const dir = join(homedir(), ".filazo-backups", "library-platforms");
  await mkdir(dir, { recursive: true });
  const backup = join(dir, `platforms-${Date.now()}.json`);
  await writeFile(backup, JSON.stringify({ plan, snapshot }, null, 2), { flag: "wx", mode: 0o600 });
  const result = await applyPlatformRepair(db, plan, platformRepairHash(snapshot));
  const after = await capturePlatformRepair(db, plan);
  validatePlatformRepair(after, plan);
  await writeFile(backup.replace(/\.json$/, "-after.json"), JSON.stringify({ result, after }, null, 2), { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify({ ...result, backup }));
}
main().finally(() => db.$disconnect()).catch(error => { console.error(error); process.exitCode = 1; });
