import { Prisma, type PrismaClient, type UserGameEntry } from "@prisma/client";
import { libraryPlatformKey } from "../src/lib/library-platform";

// Run as a coordinated release migration. Old application builds use the removed
// status identity and must be stopped before this transaction commits.
export async function migrateLibraryStatus(db: PrismaClient, schema: string) {
  const ident = (name: string) => Prisma.raw(`"${schema.replaceAll('"', '""')}"."${name}"`);
  const table = ident("UserGameEntry");
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT true AS locked FROM pg_advisory_xact_lock(hashtextextended('library-status-migration', 0))`;
    const exists = await tx.$queryRaw<{ present: boolean }[]>`SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = ${schema} AND table_name = 'UserGameEntry') AS present`;
    if (!exists[0].present) return { merged: 0, alreadyApplied: false };
    await tx.$executeRaw`LOCK TABLE ${table} IN ACCESS EXCLUSIVE MODE`;
    const applied = await tx.$queryRaw<{ present: boolean }[]>`SELECT EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname = ${schema} AND indexname = 'UserGameEntry_userId_gameId_platformKey_key') AS present`;
    if (applied[0].present) {
      await tx.$executeRaw`UPDATE ${table} SET "status" = 'OWNED' WHERE "status" = 'BACKLOG'`;
      return { merged: 0, alreadyApplied: true };
    }
    await tx.$executeRaw`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS "platformKey" TEXT NOT NULL DEFAULT 'unknown', ADD COLUMN IF NOT EXISTS "statusChangedAt" TIMESTAMP(3)`;
    await tx.$executeRaw`DROP INDEX IF EXISTS ${ident("UserGameEntry_userId_gameId_status_key")}`;

    const platforms = await tx.$queryRaw<{ platformName: string | null; provider: string | null }[]>`SELECT DISTINCT "platformName", "provider"::text FROM ${table}`;
    for (const platform of platforms) {
      const key = libraryPlatformKey(platform.platformName, platform.provider);
      await tx.$executeRaw`UPDATE ${table} SET "platformKey" = ${key} WHERE "platformName" IS NOT DISTINCT FROM ${platform.platformName} AND "provider"::text IS NOT DISTINCT FROM ${platform.provider}`;
    }
    const groups = await tx.$queryRaw<{ userId: string; gameId: string }[]>`SELECT "userId", "gameId" FROM ${table} GROUP BY "userId", "gameId" HAVING count(*) > 1`;
    let merged = 0;
    for (const group of groups) {
      const entries = await tx.userGameEntry.findMany({ where: group, orderBy: [{ updatedAt: "desc" }, { id: "asc" }] });
      // Prefer evidence of a personal choice to an OWNED row refreshed by sync.
      const chosen = entries.find(e => e.statusChangedAt) ?? entries.find(e => e.status !== "OWNED" || e.finishedAt || e.abandonedAt) ?? entries[0];
      const status = chosen.abandonedAt || chosen.status === "DROPPED" ? "DROPPED" : chosen.finishedAt ? "COMPLETED" : chosen.status;
      const known = entries.filter(e => e.platformKey !== "unknown");
      const buckets = new Map<string, UserGameEntry[]>();
      for (const entry of entries) {
        // Missing platform information is not evidence of another purchase.
        const key = entry.platformKey === "unknown" && known.length ? known[0].platformKey : entry.platformKey;
        buckets.set(key, [...(buckets.get(key) ?? []), entry]);
      }
      const survivors: string[] = [];
      // Free slots before transferring one to the retained entry.
      await tx.userGameEntry.updateMany({ where: group, data: { currentPlayingSlot: null, playingNextSlot: null } });
      for (const [platformKey, copies] of buckets) {
        const survivor = copies.find(e => e.externalAccountId) ?? copies[copies.length - 1];
        survivors.push(survivor.id);
        const archive: unknown[] = [];
        for (const duplicate of copies.filter(e => e.id !== survivor.id)) {
          const [journals, insights, observations, sessions, estimate] = await Promise.all([
            tx.gameJournalEntry.findMany({ where: { userGameEntryId: duplicate.id } }),
            tx.userGameInsight.findMany({ where: { userGameEntryId: duplicate.id } }),
            tx.playObservation.findMany({ where: { entryId: duplicate.id } }),
            tx.calendarSession.findMany({ where: { entryId: duplicate.id } }),
            tx.calendarEstimate.findUnique({ where: { entryId: duplicate.id } }),
          ]);
          archive.push({ entry: duplicate, journals, insights, observations, sessions, estimate });
          for (const journal of journals) {
            const collision = journal.externalSourceId && await tx.gameJournalEntry.findFirst({ where: { userGameEntryId: survivor.id, source: journal.source, externalSourceId: journal.externalSourceId }, select: { id: true } });
            await tx.gameJournalEntry.update({ where: { id: journal.id }, data: { userGameEntryId: survivor.id, ...(collision ? { externalSourceId: null } : {}) } });
          }
          await tx.userGameReview.updateMany({ where: { userId: group.userId, userGameEntryId: duplicate.id }, data: { userGameEntryId: survivor.id } });
          for (const session of sessions) {
            const existing = await tx.calendarSession.findUnique({ where: { entryId_day: { entryId: survivor.id, day: session.day } } });
            await tx.calendarSession.upsert({ where: { entryId_day: { entryId: survivor.id, day: session.day } }, create: { ...session, entryId: survivor.id }, update: { minutes: Math.max(existing?.minutes ?? 0, session.minutes) } });
          }
          for (const observation of observations) {
            const existing = await tx.playObservation.findUnique({ where: { entryId_day: { entryId: survivor.id, day: observation.day } } });
            if (!existing || existing.observedAt < observation.observedAt) await tx.playObservation.upsert({ where: { entryId_day: { entryId: survivor.id, day: observation.day } }, create: { ...observation, entryId: survivor.id }, update: { ...observation, entryId: survivor.id } });
          }
          if (estimate) {
            const existing = await tx.calendarEstimate.findUnique({ where: { entryId: survivor.id } });
            if (!existing || existing.calculatedAt < estimate.calculatedAt) await tx.calendarEstimate.upsert({ where: { entryId: survivor.id }, create: { ...estimate, entryId: survivor.id }, update: { ...estimate, entryId: survivor.id } });
          }
          // Insights are derived. All original values remain in the archive.
          await tx.userGameEntry.delete({ where: { id: duplicate.id, userId: group.userId } });
          merged++;
        }
        const manualTime = copies.find(e => e.playtimeSource === "manual" && e.playtimeMinutes !== null);
        const raw = survivor.rawData && typeof survivor.rawData === "object" && !Array.isArray(survivor.rawData) ? survivor.rawData : {};
        await tx.userGameEntry.update({ where: { id: survivor.id }, data: {
          platformKey,
          platformName: survivor.platformName ?? copies.find(e => e.platformName)?.platformName,
          notes: [...new Set(copies.map(e => e.notes).filter(Boolean))].join("\n\n") || null,
          isFavorite: copies.some(e => e.isFavorite), isPhysicalCopy: copies.some(e => e.isPhysicalCopy),
          playtimeMinutes: manualTime?.playtimeMinutes ?? copies.reduce<number | null>((max, e) => e.playtimeMinutes === null ? max : Math.max(max ?? 0, e.playtimeMinutes), null),
          playtimeSource: manualTime ? "manual" : survivor.playtimeSource,
          manualStartedAt: copies.find(e => e.manualStartedAt)?.manualStartedAt,
          startedAt: copies.filter(e => e.startedAt).sort((a, b) => a.startedAt!.getTime() - b.startedAt!.getTime())[0]?.startedAt,
          lastPlayedAt: copies.filter(e => e.lastPlayedAt).sort((a, b) => b.lastPlayedAt!.getTime() - a.lastPlayedAt!.getTime())[0]?.lastPlayedAt,
          completionPercent: copies.reduce<number | null>((max, e) => e.completionPercent === null ? max : Math.max(max ?? 0, e.completionPercent), null),
          userIntent: copies.find(e => e.userIntent)?.userIntent,
          desiredSessionMin: copies.find(e => e.desiredSessionMin !== null)?.desiredSessionMin,
          plannedStartDate: copies.find(e => e.plannedStartDate)?.plannedStartDate,
          ...(archive.length ? { rawData: JSON.parse(JSON.stringify({ ...raw, catalogMergeArchive: [...(Array.isArray(raw.catalogMergeArchive) ? raw.catalogMergeArchive : []), { survivorBeforeMerge: survivor, duplicates: archive }] })) as Prisma.InputJsonValue } : {}),
        } });
      }
      await tx.userGameEntry.updateMany({ where: group, data: {
        status, statusChangedAt: chosen.statusChangedAt ?? chosen.updatedAt,
        finishedAt: status === "COMPLETED" ? chosen.finishedAt ?? chosen.updatedAt : null,
        finishedSource: status === "COMPLETED" ? chosen.finishedSource ?? "manual" : null,
        abandonedAt: status === "DROPPED" ? chosen.abandonedAt ?? chosen.updatedAt : null,
        abandonReason: status === "DROPPED" ? chosen.abandonReason ?? "manual" : null,
        activeBacklog: status !== "DROPPED",
      } });
      const pinned = entries.find(e => status === "PLAYING" ? e.currentPlayingSlot !== null : e.playingNextSlot !== null);
      if (pinned && (status === "PLAYING" || status === "PLAYING_NEXT")) await tx.userGameEntry.update({ where: { id: survivors.includes(pinned.id) ? pinned.id : survivors[0] }, data: status === "PLAYING" ? { currentPlayingSlot: pinned.currentPlayingSlot } : { playingNextSlot: pinned.playingNextSlot } });
    }
    // Normalize legacy lifecycle flags even for titles that never duplicated.
    await tx.$executeRaw`UPDATE ${table} SET "statusChangedAt" = COALESCE("statusChangedAt", "updatedAt") WHERE "status" <> 'OWNED' OR "finishedAt" IS NOT NULL OR "abandonedAt" IS NOT NULL OR "source" = 'MANUAL'`;
    await tx.$executeRaw`UPDATE ${table} SET "status" = CASE WHEN "status" = 'DROPPED' OR "abandonedAt" IS NOT NULL THEN 'DROPPED' ELSE 'COMPLETED' END::${ident("UserGameStatus")} WHERE "finishedAt" IS NOT NULL OR "abandonedAt" IS NOT NULL`;
    await tx.$executeRaw`UPDATE ${table} SET "finishedAt" = CASE WHEN "status" = 'COMPLETED' THEN COALESCE("finishedAt", "updatedAt") ELSE NULL END, "finishedSource" = CASE WHEN "status" = 'COMPLETED' THEN COALESCE("finishedSource", 'manual') ELSE NULL END, "abandonedAt" = CASE WHEN "status" = 'DROPPED' THEN COALESCE("abandonedAt", "updatedAt") ELSE NULL END, "currentPlayingSlot" = CASE WHEN "status" = 'PLAYING' THEN "currentPlayingSlot" ELSE NULL END, "playingNextSlot" = CASE WHEN "status" = 'PLAYING_NEXT' THEN "playingNextSlot" ELSE NULL END`;
    await tx.$executeRaw`UPDATE ${table} SET "status" = 'OWNED' WHERE "status" = 'BACKLOG'`;
    await tx.$executeRaw`CREATE UNIQUE INDEX "UserGameEntry_userId_gameId_platformKey_key" ON ${table}("userId", "gameId", "platformKey")`;
    return { merged, alreadyApplied: false };
  }, { maxWait: 30_000, timeout: 600_000 });
}
