import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { isOngoingGame } from "./game-completion-model";
import { DAY_MS, estimateCalendarFinish, utcDay } from "./calendar-policy";
import { calendarStartForGame, collectGamePlayDates } from "./provider-play-dates";

const trackedWhere = {
  OR: [{ currentPlayingSlot: { not: null } }, { status: "PLAYING" as const }, { manualStartedAt: { not: null } }],
} satisfies Prisma.UserGameEntryWhereInput;

export async function lockUserCalendar(tx: Prisma.TransactionClient, userId: string) {
  // Serializes both trigger kinds and session writes for this user, across servers.
  await tx.$queryRaw`SELECT true AS locked FROM pg_advisory_xact_lock(hashtextextended(${`calendar:${userId}`}, 0))`;
}

export async function refreshCalendar(userId: string, trigger: "manual" | "automatic", now = new Date()) {
  return prisma.$transaction(async (tx) => {
    await lockUserCalendar(tx, userId);
    const day = utcDay(now);
    const field = trigger === "manual" ? "manualAt" : "automaticAt";
    await tx.userCalendarState.upsert({ where: { userId }, create: { userId }, update: {} });
    const claimed = await tx.userCalendarState.updateMany({
      where: { userId, OR: [{ [field]: null }, { [field]: { lt: day } }] },
      data: { [field]: now, ...(trigger === "automatic" ? { retryAfter: null } : {}) },
    });
    if (!claimed.count) return { refreshed: false };
    const entries = await tx.userGameEntry.findMany({
      where: { userId, ...trackedWhere },
      include: {
        game: { include: { providerLinks: { select: { storyAchievementId: true } }, userEntries: { where: { userId }, select: { gameId: true, provider: true, rawData: true, manualStartedAt: true } }, userPlayDates: { where: { userId } } } },
        playObservations: { where: { day: { gte: new Date(day.getTime() - 29 * DAY_MS) } }, orderBy: { observedAt: "asc" } },
      },
    });
    for (const entry of entries) {
      const samples = [...entry.playObservations];
      // Import time isn't play time. Only a fresh, accepted provider counter or
      // a session explicitly recorded here may create a new observation.
      const source = entry.playtimeSource === "calendar" ? "calendar" : entry.playtimeSource === "sync" ? entry.provider ?? "sync" : null;
      const observedAt = source === "calendar" ? now : entry.lastSyncedAt;
      if (source && observedAt && observedAt <= now && entry.playtimeMinutes !== null) {
        const sample = { observedAt, totalMinutes: entry.playtimeMinutes, source };
        const sampleDay = utcDay(observedAt);
        const existing = samples.findIndex((value) => value.day.getTime() === sampleDay.getTime());
        if (existing < 0 || samples[existing].observedAt <= observedAt) {
          await tx.playObservation.upsert({
            where: { entryId_day: { entryId: entry.id, day: sampleDay } },
            create: { entryId: entry.id, day: sampleDay, ...sample }, update: sample,
          });
          if (existing >= 0) samples.splice(existing, 1);
          samples.push({ entryId: entry.id, day: sampleDay, ...sample });
        }
      }
      const forecast = entry.playtimeSource === "manual"
        ? { estimatedFinish: null, weeklyMinutes: null, reason: "correction" }
        : estimateCalendarFinish({
        start: calendarStartForGame(entry, collectGamePlayDates(entry.game.userEntries, entry.game.userPlayDates, now), entry.game.userEntries).date,
        finished: Boolean(entry.finishedAt) || entry.status === "COMPLETED",
        paused: Boolean(entry.abandonedAt) || entry.status === "DROPPED" || entry.activeBacklog === false,
        ongoing: isOngoingGame(entry.game),
        targetMinutes: entry.game.hltbMainStoryMinutes,
        totalMinutes: entry.playtimeMinutes,
        observations: samples,
        now,
      });
      await tx.calendarEstimate.upsert({
        where: { entryId: entry.id },
        create: { entryId: entry.id, calculatedAt: now, ...forecast },
        update: { calculatedAt: now, ...forecast },
      });
      await tx.playObservation.deleteMany({ where: { entryId: entry.id, entry: { userId }, day: { lt: new Date(day.getTime() - 35 * DAY_MS) } } });
    }
    return { refreshed: true };
  }, { timeout: 25_000 });
}

export async function readCalendar(userId: string) {
  const [entries, state, releases, saved, releaseRun, storedDates, manualEvents] = await Promise.all([
    prisma.userGameEntry.findMany({
      where: { userId, OR: [...trackedWhere.OR, { provider: { not: null } }, { finishedAt: { not: null } }] },
      include: { game: true, calendarEstimate: true, calendarSessions: { where: { day: utcDay() }, take: 1 } },
      orderBy: [{ currentPlayingSlot: "asc" }, { manualStartedAt: "desc" }],
    }),
    prisma.userCalendarState.findUnique({ where: { userId } }),
    prisma.releaseAnnouncement.findMany({
      where: { checkedAt: { gte: new Date(Date.now() - 7 * DAY_MS) }, OR: [{ releaseDate: null }, { releaseDate: { gte: utcDay() } }] },
      select: { id: true, gameId: true, platform: true, region: true, releaseDate: true, dateLabel: true, sourceUrl: true, sourceUrls: true, checkedAt: true, game: { select: { name: true } } },
      orderBy: [{ checkedAt: "desc" }, { releaseDate: "asc" }], take: 30,
    }),
    prisma.userCalendarRelease.findMany({ where: { userId }, include: { release: { include: { game: { select: { name: true } } } } }, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.calendarReleaseRun.findFirst({ where: { scope: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development" }, orderBy: { day: "desc" }, select: { status: true, startedAt: true, finishedAt: true } }),
    prisma.userGamePlayDate.findMany({ where: { userId }, select: { gameId: true, provider: true, day: true, kind: true } }),
    prisma.userCalendarEvent.findMany({ where: { userId }, select: { id: true, title: true, date: true, notes: true }, orderBy: [{ date: "asc" }, { createdAt: "asc" }], take: 200 }),
  ]);
  const playDates = collectGamePlayDates(entries, storedDates);
  return { entries, state, releases, saved, releaseRun, playDates, manualEvents };
}

export async function runDailyCalendars(now = new Date()) {
  // Small batches resume on subsequent cron ticks. Each user refreshes only
  // once per UTC day, including users who never open the page that day.
  const users = await prisma.user.findMany({
    where: { gameEntries: { some: trackedWhere }, AND: [{ OR: [
      { calendarState: null }, { calendarState: { automaticAt: null } }, { calendarState: { automaticAt: { lt: utcDay(now) } } },
    ] }, { OR: [{ calendarState: null }, { calendarState: { retryAfter: null } }, { calendarState: { retryAfter: { lte: now } } }] }] },
    select: { id: true }, orderBy: { id: "asc" }, take: 10,
  });
  let updated = 0;
  let failed = 0;
  const deadline = Date.now() + 45_000;
  for (const user of users) {
    if (Date.now() > deadline) break;
    try { if ((await refreshCalendar(user.id, "automatic", now)).refreshed) updated++; }
    catch {
      failed++;
      // Defer a failing user so a batch of failures cannot starve everyone else.
      const retryAfter = new Date(now.getTime() + 60 * 60_000);
      await prisma.userCalendarState.upsert({ where: { userId: user.id }, create: { userId: user.id, retryAfter }, update: { retryAfter } }).catch(() => undefined);
    }
  }
  return { updated, failed };
}
