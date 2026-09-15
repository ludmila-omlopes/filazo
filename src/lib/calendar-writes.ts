import { prisma } from "./prisma";
import { lockUserCalendar } from "./calendar";
import { utcDay } from "./calendar-policy";

export async function saveCalendarStart(userId: string, entryId: string, start: Date, now = new Date()) {
  if (start > now || !Number.isFinite(start.getTime())) return false;
  return prisma.$transaction(async (tx) => {
    await lockUserCalendar(tx, userId);
    const result = await tx.userGameEntry.updateMany({
      where: { id: entryId, userId, OR: [{ finishedAt: null }, { finishedAt: { gte: start } }] },
      data: { manualStartedAt: start, startedAt: start },
    });
    if (!result.count) return false;
    // Clear obsolete predictions, but never spend or reset the refresh quota.
    await tx.calendarEstimate.deleteMany({ where: { entryId, entry: { userId } } });
    return true;
  });
}

export async function saveCalendarMinutes(userId: string, entryId: string, minutes: number, now = new Date()) {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 960) return false;
  return prisma.$transaction(async (tx) => {
    await lockUserCalendar(tx, userId);
    const entry = await tx.userGameEntry.findFirst({ where: { id: entryId, userId, provider: null, finishedAt: null, status: { notIn: ["COMPLETED", "DROPPED", "WISHLIST"] } } });
    if (!entry || !entry.manualStartedAt) return false;
    const day = utcDay(now);
    const previous = await tx.calendarSession.findUnique({ where: { entryId_day: { entryId, day } } });
    const totalMinutes = Math.max(0, (entry.playtimeMinutes ?? 0) + minutes - (previous?.minutes ?? 0));
    const updated = await tx.userGameEntry.updateMany({ where: { id: entryId, userId, provider: null, playtimeMinutes: entry.playtimeMinutes }, data: { playtimeMinutes: totalMinutes, playtimeSource: "calendar", ...(minutes ? { lastPlayedAt: now } : {}) } });
    if (!updated.count) return false;
    await tx.calendarSession.upsert({ where: { entryId_day: { entryId, day } }, create: { entryId, day, minutes }, update: { minutes } });
    await tx.playObservation.upsert({ where: { entryId_day: { entryId, day } }, create: { entryId, day, observedAt: now, totalMinutes, source: "calendar" }, update: { observedAt: now, totalMinutes, source: "calendar" } });
    return true;
  });
}

export async function setCalendarRelease(userId: string, releaseId: string, add: boolean) {
  if (!add) {
    await prisma.userCalendarRelease.deleteMany({ where: { userId, releaseId } });
    return true;
  }
  return prisma.$transaction(async (tx) => {
    await lockUserCalendar(tx, userId);
    const release = await tx.releaseAnnouncement.findFirst({ where: { id: releaseId, releaseDate: { gte: utcDay() } }, select: { id: true } });
    if (!release) return false;
    if (await tx.userCalendarRelease.count({ where: { userId } }) >= 200) return false;
    await tx.userCalendarRelease.createMany({ data: [{ userId, releaseId }], skipDuplicates: true });
    return true;
  });
}
