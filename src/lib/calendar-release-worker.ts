import { prisma } from "./prisma";
import { resolveCatalogGame } from "./catalog";
import { getOpenAiConfig } from "./openai";
import { getSyncWorkerScope } from "./steam-sync-state";
import { searchReleaseDates } from "./calendar-release-search";
import { utcDay } from "./calendar-policy";
import { canonicalizeGameTitle, normalizeTitle } from "./utils";

export async function runReleaseDateSearch(now = new Date()) {
  const scope = getSyncWorkerScope();
  const config = getOpenAiConfig();
  if (!config || process.env.CALENDAR_RELEASE_SEARCH_ENABLED !== "true") return { status: "disabled" };
  const day = utcDay(now);
  // Atomic uniqueness prevents parallel cron requests from buying extra searches.
  const claim = await prisma.calendarReleaseRun.createMany({ data: [{ day, scope, status: "running", model: config.model }], skipDuplicates: true });
  if (!claim.count) return { status: "already_run" };
  try {
    const watched = await prisma.releaseAnnouncement.findMany({
      where: { subscribers: { some: {} }, OR: [{ releaseDate: null }, { releaseDate: { gte: day } }] },
      select: { game: { select: { name: true } }, platform: true, region: true },
      orderBy: { checkedAt: "asc" }, take: 8,
    });
    const result = await searchReleaseDates(config, now, watched.map((item) => `${item.game.name} (${item.platform}, ${item.region})`));
    await prisma.calendarReleaseRun.update({ where: { day_scope: { day, scope } }, data: { usage: result.usage } });
    for (const release of result.releases) {
      // Use canonical resolution under the same title lock used by imports.
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`title:${normalizeTitle(canonicalizeGameTitle(release.title))}`}, 0))`;
        const game = await resolveCatalogGame({ title: release.title, platformName: release.platform, deferEnrichment: true }, tx);
      const data = { platform: release.platform, region: release.region, releaseDate: release.releaseDate, dateLabel: release.dateLabel, sourceUrl: release.sourceUrl, sourceUrls: release.sourceUrls };
        await tx.releaseAnnouncement.upsert({
          where: { gameId_platform_region: { gameId: game.id, platform: release.platform, region: release.region } },
          create: { gameId: game.id, ...data, checkedAt: now }, update: { ...data, checkedAt: now },
        });
      }, { timeout: 25_000 });
    }
    await prisma.calendarReleaseRun.update({ where: { day_scope: { day, scope } }, data: { status: "completed", usage: result.usage, finishedAt: new Date() } });
    return { status: "completed", releases: result.releases.length };
  } catch {
    await prisma.calendarReleaseRun.update({ where: { day_scope: { day, scope } }, data: { status: "failed", finishedAt: new Date() } });
    return { status: "failed" };
  }
}
