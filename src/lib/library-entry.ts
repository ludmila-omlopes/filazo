import { Prisma, type UserGameStatus, type UserGameEntry, type ExternalProvider, type EntrySource } from "@prisma/client";
import { getSyncedEntryProgressData } from "./playtime-conflict";
import type { SyncedLibraryGame } from "./providers/contracts";
import { prisma } from "./prisma";
import { libraryPlatformKey } from "./library-platform";
import { normalizeLibraryStatus } from "./library-status";

export async function lockLibraryGame(tx: Prisma.TransactionClient, userId: string, gameId: string) {
  // A user lock also serializes transactions that update several pinned games.
  await tx.$queryRaw`SELECT true AS locked FROM pg_advisory_xact_lock(hashtextextended(${`library-user:${userId}`}, 0))`;
  await tx.$queryRaw`SELECT true AS locked FROM pg_advisory_xact_lock(hashtextextended(${`library:${userId}:${gameId}`}, 0))`;
}

export function libraryStatusData(status: UserGameStatus, now = new Date()) {
  status = normalizeLibraryStatus(status);
  return {
    status,
    finishedAt: status === "COMPLETED" ? now : null,
    finishedSource: status === "COMPLETED" ? "manual" : null,
    abandonedAt: status === "DROPPED" ? now : null,
    abandonReason: status === "DROPPED" ? "manual" : null,
    activeBacklog: status !== "DROPPED",
    ...(status !== "PLAYING" ? { currentPlayingSlot: null } : {}),
    ...(status !== "PLAYING_NEXT" ? { playingNextSlot: null, plannedStartDate: null } : {}),
  };
}

// All status entry points use this write under the same lock as provider imports.
export async function setLibraryGameStatus(tx: Prisma.TransactionClient, userId: string, gameId: string, status: UserGameStatus) {
  status = normalizeLibraryStatus(status);
  await lockLibraryGame(tx, userId, gameId);
  const previous = await tx.userGameEntry.findFirst({ where: { userId, gameId }, orderBy: [{ statusChangedAt: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }] });
  return tx.userGameEntry.updateMany({
    where: { userId, gameId },
    data: {
      ...libraryStatusData(status), statusChangedAt: new Date(),
      ...(status === "COMPLETED" && previous?.status === status && previous.finishedAt ? { finishedAt: previous.finishedAt, finishedSource: previous.finishedSource } : {}),
      ...(status === "DROPPED" && previous?.status === status && previous.abandonedAt ? { abandonedAt: previous.abandonedAt, abandonReason: previous.abandonReason } : {}),
    },
  });
}

export async function setLibraryEntryStatus(userId: string, entryId: string, status: UserGameStatus) {
  return prisma.$transaction(async tx => {
    const entry = await tx.userGameEntry.findFirst({ where: { id: entryId, userId }, select: { gameId: true } });
    if (!entry) return false;
    await setLibraryGameStatus(tx, userId, entry.gameId, status);
    return true;
  });
}

export async function setInferredLibraryCompletion(userId: string, entryId: string, unlockedAt: Date | null) {
  return prisma.$transaction(async tx => {
    await lockLibraryGame(tx, userId, "story-completion");
    const entry = await tx.userGameEntry.findFirst({ where: { id: entryId, userId } });
    if (!entry || entry.finishedAt || entry.statusChangedAt) return false;
    const chosen = await tx.userGameEntry.findFirst({ where: { userId, gameId: entry.gameId, statusChangedAt: { not: null } } });
    if (chosen) return false;
    await tx.userGameEntry.updateMany({ where: { userId, gameId: entry.gameId }, data: {
      ...libraryStatusData("COMPLETED", unlockedAt ?? new Date()), finishedSource: "story_achievement",
    } });
    return true;
  });
}

type CopyInput = {
  userId: string;
  gameId: string;
  platformName?: string | null;
  provider?: string | null;
  status: UserGameStatus;
  explicitStatus?: boolean;
  create: Omit<Prisma.UserGameEntryUncheckedCreateInput, "userId" | "gameId" | "status">;
  update: Prisma.UserGameEntryUncheckedUpdateInput;
  sourceData?: (existing: UserGameEntry | null) => Prisma.UserGameEntryUncheckedUpdateInput;
};

export async function upsertLibraryCopy(input: CopyInput, db: Prisma.TransactionClient = prisma) {
  const write = async (tx: Prisma.TransactionClient) => {
    await lockLibraryGame(tx, input.userId, input.gameId);
    // Ownership is checked under a row lock, so disconnect/reassignment cannot race this write.
    const accountId = input.create.externalAccountId;
    if (accountId) {
      const schema = new URL(process.env.DATABASE_URL!).searchParams.get("schema") || "public";
      const table = Prisma.raw(`"${schema.replaceAll('"', '""')}"."ExternalAccount"`);
      const owner = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM ${table} WHERE id = ${accountId} AND "userId" = ${input.userId} FOR SHARE`;
      if (!owner.length) throw new Error("Platform account ownership changed. Reconnect before syncing.");
    }
    const copies = await tx.userGameEntry.findMany({ where: { userId: input.userId, gameId: input.gameId }, orderBy: [{ statusChangedAt: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }, { id: "asc" }] });
    let key = libraryPlatformKey(input.platformName, input.provider);
    // An unspecified platform is not proof of an additional purchase.
    if (key === "unknown" && copies.length) key = copies[0].platformKey;
    let existing = copies.find(copy => copy.platformKey === key);
    if (!existing && copies.length === 1 && copies[0].platformKey === "unknown") {
      existing = await tx.userGameEntry.update({ where: { id: copies[0].id, userId: input.userId }, data: { platformKey: key } });
    }
    const chosen = copies.find(copy => copy.statusChangedAt !== null) ?? copies[0];
    const status = normalizeLibraryStatus(input.explicitStatus ? input.status : chosen?.status ?? input.status);
    const now = new Date();
    if (input.explicitStatus) await setLibraryGameStatus(tx, input.userId, input.gameId, status);
    // Imports update only source data. They cannot change a person's status or lifecycle fields.
    const { status: _status, finishedAt: _finished, finishedSource: _finishedSource,
      abandonedAt: _abandoned, abandonReason: _reason, activeBacklog: _active,
      statusChangedAt: _statusChangedAt, userId: _user, gameId: _game, platformKey: _platform,
      ...sourceUpdate } = input.sourceData?.(existing ?? null) ?? input.update;
    void [_status, _finished, _finishedSource, _abandoned, _reason, _active, _statusChangedAt, _user, _game, _platform];
    if (existing?.rawData && typeof existing.rawData === "object" && !Array.isArray(existing.rawData) &&
        sourceUpdate.rawData && typeof sourceUpdate.rawData === "object" && !Array.isArray(sourceUpdate.rawData)) {
      sourceUpdate.rawData = {
        ...existing.rawData, ...sourceUpdate.rawData,
        ...(existing.rawData.catalogMergeArchive ? { catalogMergeArchive: existing.rawData.catalogMergeArchive } : {}),
      } as Prisma.InputJsonValue;
    }
    if (existing) return tx.userGameEntry.update({ where: { id: existing.id, userId: input.userId }, data: sourceUpdate });
    return tx.userGameEntry.create({ data: {
      ...input.create, userId: input.userId, gameId: input.gameId, platformKey: key,
      ...libraryStatusData(status, chosen?.status === status ? chosen.finishedAt ?? now : now),
      ...(!chosen && !input.explicitStatus && input.create.finishedSource ? { finishedSource: input.create.finishedSource } : {}),
      ...(chosen && !input.explicitStatus ? { finishedAt: chosen.finishedAt, finishedSource: chosen.finishedSource, abandonedAt: chosen.abandonedAt, abandonReason: chosen.abandonReason, activeBacklog: chosen.activeBacklog } : {}),
      statusChangedAt: input.explicitStatus ? now : chosen?.statusChangedAt,
    } });
  };
  return db === prisma ? prisma.$transaction(write, { timeout: 20_000 }) : write(db);
}

export async function syncLibraryCopy({ userId, gameId, accountId, provider, source, game }: {
  userId: string; gameId: string; accountId: string; provider: ExternalProvider; source: EntrySource; game: SyncedLibraryGame;
}, db: Prisma.TransactionClient = prisma) {
  const sourceData = (existing: UserGameEntry | null) => {
    const raw = existing?.rawData && typeof existing.rawData === "object" && !Array.isArray(existing.rawData) ? existing.rawData : {};
    // GOG ownership-only refreshes must not displace a source supplying progress.
    if (provider === "GOG" && existing?.externalAccountId && existing.provider !== "GOG") {
      return { lastSyncedAt: new Date(), rawData: { ...raw, gogSync: game.rawData ?? {} } as Prisma.InputJsonValue };
    }
    return {
      source, provider, externalAccountId: accountId, platformName: game.platformName ?? undefined,
      ...getSyncedEntryProgressData(existing, game), lastSyncedAt: new Date(),
      rawData: { ...raw, ...game.rawData } as Prisma.InputJsonValue,
    };
  };
  return upsertLibraryCopy({ userId, gameId, provider, platformName: game.platformName, status: "OWNED",
    create: { ...sourceData(null), source, provider, externalAccountId: accountId }, update: {}, sourceData,
  }, db);
}
