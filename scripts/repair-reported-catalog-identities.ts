import { loadEnvConfig } from "@next/env";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";
import { PrismaClient } from "@prisma/client";
import { getIgdbGameBySteamAppId } from "../src/lib/igdb";
import { applyReportedIdentityRepair, captureRepairSnapshot, repairPreview, reportedIdentities } from "./catalog-identity-repair";

loadEnvConfig(process.cwd(), true);
const db = new PrismaClient();
async function main() {
  const metadata = new Map();
  for (const identity of reportedIdentities) {
    const data = await getIgdbGameBySteamAppId(identity.appId, AbortSignal.timeout(15_000));
    if (data?.igdbId !== identity.correctId) throw new Error(`Unverified external identity for ${identity.appId}`);
    metadata.set(identity.correctId, data);
  }
  const snapshot = await captureRepairSnapshot(db);
  console.log(JSON.stringify(repairPreview(snapshot), null, 2));
  if (!process.argv.includes("--apply")) return;
  const backupDir = resolve(homedir(), ".filazo-backups", "catalog-identities");
  mkdirSync(backupDir, { recursive: true });
  const backup = resolve(backupDir, `identity-${Date.now()}.json`);
  writeFileSync(backup, JSON.stringify(snapshot, null, 2), { flag: "wx", mode: 0o600 });
  console.log(`Backup written: ${backup}`);
  await applyReportedIdentityRepair(db, snapshot, metadata);
  console.log("Repair committed. Verification:");
  console.log(JSON.stringify(repairPreview(await captureRepairSnapshot(db)), null, 2));
}
main().finally(() => db.$disconnect()).catch(error => { console.error(error.message); process.exitCode = 1; });
