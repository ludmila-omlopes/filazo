import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { normalizeTitle } from "../src/lib/utils";
import { inferGameCompletionModel } from "../src/lib/game-completion-model";
import type { EnrichedGameMetadata } from "../src/lib/providers/contracts";

export const reportedIdentities = [
  { appId: "400", oldId: 14546, correctId: 71 },
  { appId: "460810", oldId: 220716, correctId: 3218 },
  { appId: "1040420", oldId: 201196, correctId: 116166 },
  { appId: "1145360", oldId: 80529, correctId: 113112 },
  { appId: "883710", oldId: 880, correctId: 19686 },
] as const;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

const remakePsIds = new Set(["CUSA09171_00", "CUSA09193_00", "PPSA04288_00", "PPSA04289_00", "NPWR15179_00", "NPWR26027_00"]);
const remakeXboxIds = new Set(["1828912468", "374621264"]);

export function isRe2RemakeLink(provider: string, id: string) {
  if (provider === "STEAM") return id === "883710";
  if (provider === "IGDB") return id === "19686";
  if (provider === "XBOX") return ["titleId:1828912468", "titleId:374621264", "scid:00000000-0000-0000-0000-00006d02fd54", "scid:54580100-f968-45a6-9694-320b16544450", "pfn:F024294D.GAMEResidentEvil2biohazard2_8fty0by30jkny"].includes(id);
  if (provider !== "PLAYSTATION") return false;
  return [...remakePsIds].some(key => id.endsWith(`:${key}`) || id.includes(`-${key}-`));
}

export function isProvenRe2RemakeEntry(entry: { source: string; rawData: unknown }) {
  const raw = record(entry.rawData);
  if (entry.source === "STEAM") return String(raw.appid) === "883710";
  if (entry.source === "MANUAL") return raw.igdbId === 19686;
  if (entry.source === "XBOX") {
    const titles = [raw.title, record(raw.titleHubTitle).title, raw.achievementTitle].map(record).filter(title => title.titleId != null);
    return titles.length > 0 && titles.every(title => remakeXboxIds.has(String(title.titleId)));
  }
  if (entry.source !== "PLAYSTATION" || !Array.isArray(raw.playStationSyncSources)) return false;
  let identified = false;
  for (const value of raw.playStationSyncSources) {
    const source = record(value);
    const name = record(source.concept).name;
    if (typeof name === "string" && normalizeTitle(name) !== "resident evil 2") return false;
    // Only IDs on the actual source item count; related titleIds/concept lists are not identity proof.
    for (const key of ["titleId", "npCommunicationId", "productId", "entitlementId"]) {
      const id = source[key];
      if (typeof id !== "string") continue;
      const match = /(?:CUSA|PPSA|NPWR)\d+_\d+/.exec(id)?.[0];
      if (!match) continue;
      if (!remakePsIds.has(match)) return false;
      identified = true;
    }
  }
  return identified;
}

export async function captureRepairSnapshot(db: PrismaClient | Prisma.TransactionClient) {
  const ids = (await db.gameProviderLink.findMany({
    where: { provider: "STEAM", providerGameId: { in: reportedIdentities.map(row => row.appId) } },
    select: { gameId: true },
  })).map(link => link.gameId);
  const games = await db.game.findMany({ where: { OR: [{ id: { in: ids } }, { igdbId: { in: reportedIdentities.flatMap(row => [row.oldId, row.correctId]) } }] }, orderBy: { id: "asc" } });
  const gameIds = games.map(game => game.id);
  const where = { gameId: { in: gameIds } };
  const [links, entries, userLinks, reviews, journal, playDates] = await Promise.all([
    db.gameProviderLink.findMany({ where, orderBy: { id: "asc" } }),
    db.userGameEntry.findMany({ where, orderBy: { id: "asc" } }),
    db.userGameProviderLink.findMany({ where, orderBy: { id: "asc" } }),
    db.userGameReview.findMany({ where, orderBy: { id: "asc" } }),
    db.gameJournalEntry.findMany({ where, orderBy: { id: "asc" } }),
    db.userGamePlayDate.findMany({ where, orderBy: [{ userId: "asc" }, { gameId: "asc" }, { provider: "asc" }, { day: "asc" }, { kind: "asc" }] }),
  ]);
  return { games, links, entries, userLinks, reviews, journal, playDates };
}

export type RepairSnapshot = Awaited<ReturnType<typeof captureRepairSnapshot>>;
export function snapshotHash(snapshot: RepairSnapshot) { return createHash("sha256").update(JSON.stringify(snapshot)).digest("hex"); }

function metadataFields(metadata: EnrichedGameMetadata) {
  const completion = inferGameCompletionModel({ genres: metadata.genres, gameModes: metadata.gameModes });
  return {
    name: metadata.name, normalizedName: normalizeTitle(metadata.name), igdbId: metadata.igdbId,
    igdbSlug: metadata.slug, summary: metadata.summary, coverUrl: metadata.coverUrl, heroUrl: metadata.heroUrl,
    releaseDate: metadata.releaseDate, genres: metadata.genres ?? [], gameModes: metadata.gameModes ?? [],
    platforms: metadata.platforms ?? [], screenshots: metadata.screenshots ?? [], websites: metadata.websites ?? [],
    aggregatedRating: metadata.aggregatedRating, totalRatingCount: metadata.totalRatingCount,
    metadataSource: "IGDB" as const, igdbCheckedAt: new Date(),
    completionModel: completion.model, completionModelSource: "RULES" as const,
    completionModelConfidence: completion.confidence, completionModelCheckedAt: new Date(),
  };
}

export function repairPreview(snapshot: RepairSnapshot) {
  return reportedIdentities.map(identity => {
    const link = snapshot.links.find(link => link.provider === "STEAM" && link.providerGameId === identity.appId);
    const game = snapshot.games.find(game => game.id === link?.gameId);
    if (!game) throw new Error(`Missing Steam identity ${identity.appId}`);
    if (game.igdbId !== identity.oldId && game.igdbId !== identity.correctId) throw new Error(`Unexpected identity for ${identity.appId}`);
    const entries = snapshot.entries.filter(entry => entry.gameId === game.id);
    const pending = identity.appId === "883710" && game.igdbId !== identity.correctId
      ? entries.filter(entry => !isProvenRe2RemakeEntry(entry)).map(entry => entry.id) : [];
    return { appId: identity.appId, name: game.name, gameId: game.id, oldId: game.igdbId, correctId: identity.correctId,
      alreadyCorrect: game.igdbId === identity.correctId, entries: entries.length, pendingEntryIds: pending };
  });
}

// Maintenance only. Never called by user requests or sync workers.
export async function applyReportedIdentityRepair(db: PrismaClient, snapshot: RepairSnapshot, metadata: Map<number, EnrichedGameMetadata>) {
  const preview = repairPreview(snapshot);
  return db.$transaction(async tx => {
    const schema = new URL(process.env.DATABASE_URL!).searchParams.get("schema") || "public";
    const table = (name: string) => Prisma.raw(`"${schema.replaceAll('"', '""')}"."${name}"`);
    // Bounded maintenance window: block concurrent sync/metadata/diary writes while checking and repairing.
    await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '10s'");
    for (const name of ["Game", "GameProviderLink", "UserGameEntry", "UserGameProviderLink", "UserGameReview", "GameJournalEntry", "UserGamePlayDate"]) {
      await tx.$executeRaw`LOCK TABLE ${table(name)} IN SHARE ROW EXCLUSIVE MODE`;
    }
    if (snapshotHash(await captureRepairSnapshot(tx)) !== snapshotHash(snapshot)) throw new Error("Catalog changed after backup; create a fresh preview and backup.");
    for (const item of preview) {
      if (item.alreadyCorrect) continue;
      const data = metadata.get(item.correctId);
      if (!data || data.igdbId !== item.correctId || !data.coverUrl || !data.summary) throw new Error("Verified metadata unavailable");
      const existingTarget = await tx.game.findUnique({ where: { igdbId: item.correctId } });
      if (item.appId !== "883710") {
        const entries = snapshot.entries.filter(entry => entry.gameId === item.gameId);
        const proven = entries.every(entry => {
          const raw = record(entry.rawData);
          if (entry.source === "STEAM") return String(raw.appid) === item.appId;
          if (item.appId === "1145360" && entry.source === "XBOX") return record(raw.title).name === "Hades" && record(record(raw.title).detail).developerName === "Supergiant Games";
          if (entry.source !== "PLAYSTATION" || !Array.isArray(raw.playStationSyncSources)) return false;
          const trophyIds = raw.playStationSyncSources.map(value => record(value).npCommunicationId).filter(Boolean);
          const allowed = item.appId === "1145360" ? ["NPWR23774_00", "NPWR23783_00"] : item.appId === "460810" ? ["NPWR01135_00"] : [];
          return trophyIds.length > 0 && trophyIds.every(id => typeof id === "string" && allowed.includes(id));
        });
        if (!proven) throw new Error(`Unproven personal identity for ${item.appId}; review before relabeling`);
        if (existingTarget && existingTarget.id !== item.gameId) throw new Error("Canonical target already exists; review consolidation first.");
        await tx.game.update({ where: { id: item.gameId, igdbId: item.oldId! }, data: metadataFields(data) });
        await tx.gameProviderLink.deleteMany({ where: { gameId: item.gameId, provider: "IGDB", providerGameId: { not: String(item.correctId) } } });
        const link = await tx.gameProviderLink.findUnique({ where: { provider_providerGameId: { provider: "IGDB", providerGameId: String(item.correctId) } } });
        if (link && link.gameId !== item.gameId) throw new Error("IGDB link points to another canonical game");
        await tx.gameProviderLink.upsert({ where: { provider_providerGameId: { provider: "IGDB", providerGameId: String(item.correctId) } },
          create: { gameId: item.gameId, provider: "IGDB", providerGameId: String(item.correctId) }, update: {} });
        continue;
      }

      // RE2 contains proven original/remake identities and unrelated PS imports: split, never relabel all rows.
      const target = existingTarget ?? await tx.game.create({ data: { ...metadataFields(data), slug: `${data.slug}-${data.igdbId}` } });
      const entries = snapshot.entries.filter(entry => entry.gameId === item.gameId && isProvenRe2RemakeEntry(entry));
      for (const entry of entries) {
        if (await tx.userGameEntry.findUnique({ where: { userId_gameId_platformKey: { userId: entry.userId, gameId: target.id, platformKey: entry.platformKey } } })) {
          throw new Error("Target copy already exists; cannot merge personal history automatically");
        }
        await tx.userGameEntry.update({ where: { id: entry.id, userId: entry.userId, gameId: item.gameId }, data: { gameId: target.id, updatedAt: entry.updatedAt } });
        await tx.userGameReview.updateMany({ where: { userGameEntryId: entry.id, userId: entry.userId, gameId: item.gameId }, data: { gameId: target.id } });
        await tx.gameJournalEntry.updateMany({ where: { userGameEntryId: entry.id, userId: entry.userId, gameId: item.gameId }, data: { gameId: target.id } });
        // Move source-derived dates only when no copy from that source remains ambiguous.
        const remaining = snapshot.entries.some(other => other.gameId === item.gameId && other.userId === entry.userId && other.provider === entry.provider && !isProvenRe2RemakeEntry(other));
        if (entry.provider && !remaining) {
          const dates = snapshot.playDates.filter(date => date.gameId === item.gameId && date.userId === entry.userId && date.provider === entry.provider);
          if (dates.length) {
            await tx.userGamePlayDate.createMany({ data: dates.map(date => ({ ...date, gameId: target.id })), skipDuplicates: true });
            await tx.userGamePlayDate.deleteMany({ where: { gameId: item.gameId, userId: entry.userId, provider: entry.provider } });
          }
        }
      }
      for (const link of snapshot.links.filter(link => link.gameId === item.gameId && isRe2RemakeLink(link.provider, link.providerGameId))) {
        await tx.gameProviderLink.update({ where: { id: link.id, gameId: item.gameId }, data: { gameId: target.id } });
      }
      for (const link of snapshot.userLinks.filter(link => link.gameId === item.gameId && isRe2RemakeLink(link.provider, link.providerGameId))) {
        await tx.userGameProviderLink.update({ where: { id: link.id, userId: link.userId, gameId: item.gameId }, data: { gameId: target.id } });
      }
      await tx.gameProviderLink.upsert({ where: { provider_providerGameId: { provider: "IGDB", providerGameId: String(item.correctId) } },
        create: { gameId: target.id, provider: "IGDB", providerGameId: String(item.correctId) }, update: { gameId: target.id } });
    }
    return preview;
  }, { timeout: 60_000, maxWait: 15_000 });
}
