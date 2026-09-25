import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { jsonRecord, legacySourceIds, readPlatformEvidence } from "../src/lib/library-platform-evidence";
import { libraryPlatformKey } from "../src/lib/library-platform";
import { lockLibraryGame } from "../src/lib/library-entry";

export type PlatformRepairPair = { duplicateId: string; survivorId: string };
export type PlatformRepairPlan = { userId: string; pairs: PlatformRepairPair[] };
type Db = PrismaClient | Prisma.TransactionClient;

export async function capturePlatformRepair(db: Db, plan: PlatformRepairPlan) {
  const ids = plan.pairs.flatMap(pair => [pair.duplicateId, pair.survivorId]);
  if (!plan.userId || !ids.length || new Set(ids).size !== ids.length) throw new Error("Invalid repair plan.");
  const entries = await db.userGameEntry.findMany({ where: { userId: plan.userId, id: { in: ids } }, orderBy: { id: "asc" } });
  const entryWhere = { userGameEntryId: { in: entries.map(e => e.id) } };
  const calendarWhere = { entryId: { in: entries.map(e => e.id) } };
  const [journals, reviews, insights, observations, sessions, estimates, accounts] = await Promise.all([
    db.gameJournalEntry.findMany({ where: { ...entryWhere, userId: plan.userId }, orderBy: { id: "asc" } }),
    db.userGameReview.findMany({ where: { ...entryWhere, userId: plan.userId }, orderBy: { id: "asc" } }),
    db.userGameInsight.findMany({ where: { ...entryWhere, userId: plan.userId }, orderBy: { id: "asc" } }),
    db.playObservation.findMany({ where: calendarWhere, orderBy: [{ entryId: "asc" }, { day: "asc" }] }),
    db.calendarSession.findMany({ where: calendarWhere, orderBy: [{ entryId: "asc" }, { day: "asc" }] }),
    db.calendarEstimate.findMany({ where: calendarWhere, orderBy: { entryId: "asc" } }),
    db.externalAccount.findMany({ where: { userId: plan.userId, id: { in: entries.flatMap(e => e.externalAccountId ? [e.externalAccountId] : []) } }, select: { id: true, userId: true, provider: true }, orderBy: { id: "asc" } }),
  ]);
  const media = await db.journalMedia.findMany({ where: { journalEntryId: { in: journals.map(j => j.id) } }, orderBy: { id: "asc" } });
  return { entries, journals, reviews, insights, observations, sessions, estimates, media, accounts };
}
export type PlatformRepairSnapshot = Awaited<ReturnType<typeof capturePlatformRepair>>;
export function platformRepairHash(snapshot: PlatformRepairSnapshot) {
  return createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
}

export function validatePlatformRepair(snapshot: PlatformRepairSnapshot, plan: PlatformRepairPlan) {
  for (const pair of plan.pairs) {
    const duplicate = snapshot.entries.find(e => e.id === pair.duplicateId);
    const survivor = snapshot.entries.find(e => e.id === pair.survivorId);
    if (!survivor || survivor.userId !== plan.userId) throw new Error("Missing owned survivor.");
    if (!duplicate) {
      const archive = jsonRecord(survivor.rawData).platformRepairArchive;
      if (Array.isArray(archive) && archive.some(a => jsonRecord(jsonRecord(a).entry).id === pair.duplicateId)) continue;
      throw new Error("Missing duplicate without repair receipt.");
    }
    if (duplicate.userId !== plan.userId || duplicate.gameId !== survivor.gameId) throw new Error("Entries do not belong to the same user and game.");
    if (duplicate.externalAccountId || readPlatformEvidence(duplicate.rawData)) throw new Error("Confirmed or newly recorded platforms require separate review.");
    if (duplicate.platformKey !== "xbox-series" || duplicate.provider === "XBOX") throw new Error("Not a legacy automatic Xbox label.");
    if (!survivor.externalAccountId || !survivor.provider || !snapshot.accounts.some(a => a.id === survivor.externalAccountId && a.provider === survivor.provider)) throw new Error("Survivor needs verified account ownership.");
    if (survivor.platformKey !== libraryPlatformKey(survivor.platformName, survivor.provider) || survivor.platformKey.startsWith("xbox")) throw new Error("Invalid survivor platform.");
    const from = legacySourceIds(duplicate.rawData, survivor.provider);
    const to = legacySourceIds(survivor.rawData, survivor.provider);
    if (!from.length || !to.length || !from.every(id => to.includes(id))) throw new Error("Ambiguous provider identity; no automatic merge.");
    if (duplicate.status !== survivor.status || duplicate.finishedAt?.getTime() !== survivor.finishedAt?.getTime()) throw new Error("Conflicting status requires review.");
    if (duplicate.playtimeSource === "manual" && survivor.playtimeSource === "manual" && duplicate.playtimeMinutes !== survivor.playtimeMinutes) throw new Error("Conflicting manual hours require review.");
    for (const field of ["currentPlayingSlot", "playingNextSlot", "desiredSessionMin", "manualStartedAt", "plannedStartDate"] as const) {
      if (duplicate[field] != null && survivor[field] != null && String(duplicate[field]) !== String(survivor[field])) throw new Error(`Conflicting ${field} requires review.`);
    }
  }
}

export async function applyPlatformRepair(db: PrismaClient, plan: PlatformRepairPlan, expectedHash: string) {
  return db.$transaction(async tx => {
    await lockLibraryGame(tx, plan.userId, "platform-repair");
    // Maintenance only: hold writes while verifying the external backup and moving dependent rows.
    const schema = new URL(process.env.DATABASE_URL!).searchParams.get("schema") ?? "public";
    const ident = (name: string) => `"${schema.replaceAll('"', '""')}"."${name}"`;
    await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '10s'");
    await tx.$executeRawUnsafe(`LOCK TABLE ${["UserGameEntry", "ExternalAccount", "GameJournalEntry", "JournalMedia", "UserGameReview", "UserGameInsight", "PlayObservation", "CalendarSession", "CalendarEstimate"].map(ident).join(", ")} IN SHARE ROW EXCLUSIVE MODE`);
    const snapshot = await capturePlatformRepair(tx, plan);
    if (platformRepairHash(snapshot) !== expectedHash) throw new Error("Data changed after backup. Take a fresh snapshot.");
    validatePlatformRepair(snapshot, plan);
    let merged = 0;
    for (const pair of plan.pairs) {
      const duplicate = snapshot.entries.find(e => e.id === pair.duplicateId);
      const survivor = snapshot.entries.find(e => e.id === pair.survivorId)!;
      if (!duplicate) continue;
      const dependent = <T extends { userGameEntryId: string }>(rows: T[]) => rows.filter(row => row.userGameEntryId === duplicate.id);
      const calendar = <T extends { entryId: string }>(rows: T[]) => rows.filter(row => row.entryId === duplicate.id);
      for (const journal of dependent(snapshot.journals)) {
        const collision = journal.externalSourceId && await tx.gameJournalEntry.findFirst({ where: { userId: plan.userId, userGameEntryId: survivor.id, source: journal.source, externalSourceId: journal.externalSourceId } });
        await tx.gameJournalEntry.update({ where: { id: journal.id, userId: plan.userId }, data: { userGameEntryId: survivor.id, ...(collision ? { externalSourceId: null } : {}), updatedAt: journal.updatedAt } });
      }
      for (const review of dependent(snapshot.reviews)) await tx.userGameReview.update({ where: { id: review.id, userId: plan.userId }, data: { userGameEntryId: survivor.id, updatedAt: review.updatedAt } });
      for (const insight of dependent(snapshot.insights)) {
        if (!await tx.userGameInsight.findUnique({ where: { userGameEntryId_signalType: { userGameEntryId: survivor.id, signalType: insight.signalType } } })) {
          await tx.userGameInsight.update({ where: { id: insight.id, userId: plan.userId }, data: { userGameEntryId: survivor.id, updatedAt: insight.updatedAt } });
        }
      }
      for (const session of calendar(snapshot.sessions)) {
        const existing = await tx.calendarSession.findUnique({ where: { entryId_day: { entryId: survivor.id, day: session.day } } });
        await tx.calendarSession.upsert({ where: { entryId_day: { entryId: survivor.id, day: session.day } }, create: { ...session, entryId: survivor.id }, update: { minutes: Math.max(existing?.minutes ?? 0, session.minutes) } });
      }
      for (const observation of calendar(snapshot.observations)) {
        const existing = await tx.playObservation.findUnique({ where: { entryId_day: { entryId: survivor.id, day: observation.day } } });
        if (!existing || existing.observedAt < observation.observedAt) await tx.playObservation.upsert({ where: { entryId_day: { entryId: survivor.id, day: observation.day } }, create: { ...observation, entryId: survivor.id }, update: { ...observation, entryId: survivor.id } });
      }
      const estimate = snapshot.estimates.find(e => e.entryId === duplicate.id);
      if (estimate && !snapshot.estimates.some(e => e.entryId === survivor.id)) await tx.calendarEstimate.update({ where: { entryId: duplicate.id }, data: { entryId: survivor.id } });
      const raw = jsonRecord(survivor.rawData);
      const archive = Array.isArray(raw.platformRepairArchive) ? raw.platformRepairArchive : [];
      const manual = [survivor, duplicate].find(e => e.playtimeSource === "manual" && e.playtimeMinutes !== null);
      const earliest = (dates: Array<Date | null>) => dates.filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
      // Free occupied slots before transferring them. All originals remain in the backup and archive.
      await tx.userGameEntry.delete({ where: { id: duplicate.id, userId: plan.userId } });
      await tx.userGameEntry.update({ where: { id: survivor.id, userId: plan.userId }, data: {
        isFavorite: survivor.isFavorite || duplicate.isFavorite, isPhysicalCopy: survivor.isPhysicalCopy || duplicate.isPhysicalCopy,
        notes: [...new Set([survivor.notes, duplicate.notes].filter(Boolean))].join("\n\n") || null,
        playtimeMinutes: manual?.playtimeMinutes ?? survivor.playtimeMinutes ?? duplicate.playtimeMinutes,
        playtimeSource: manual ? "manual" : survivor.playtimeSource,
        startedAt: earliest([survivor.startedAt, duplicate.startedAt]), manualStartedAt: survivor.manualStartedAt ?? duplicate.manualStartedAt,
        currentPlayingSlot: survivor.currentPlayingSlot ?? duplicate.currentPlayingSlot,
        playingNextSlot: survivor.playingNextSlot ?? duplicate.playingNextSlot,
        plannedStartDate: survivor.plannedStartDate ?? duplicate.plannedStartDate,
        desiredSessionMin: survivor.desiredSessionMin ?? duplicate.desiredSessionMin,
        userIntent: survivor.userIntent, createdAt: earliest([survivor.createdAt, duplicate.createdAt])!,
        rawData: JSON.parse(JSON.stringify({ ...raw,
          libraryPlatformEvidence: { version: 1, source: "sync", platformKey: survivor.platformKey, provider: survivor.provider,
            providerGameId: survivor.provider === "STEAM" ? legacySourceIds(survivor.rawData, "STEAM")[0] : null, externalAccountId: survivor.externalAccountId },
          platformRepairArchive: [...archive, { reason: "legacy-automatic-platform-confirmed-by-owner", entry: duplicate,
            survivorBeforeMerge: survivor, journals: dependent(snapshot.journals), reviews: dependent(snapshot.reviews),
            insights: dependent(snapshot.insights), observations: calendar(snapshot.observations), sessions: calendar(snapshot.sessions), estimate }],
        })) as Prisma.InputJsonValue,
      } });
      merged++;
    }
    return { merged };
  }, { timeout: 60_000, maxWait: 15_000 });
}
