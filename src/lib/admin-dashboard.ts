import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { isAdminEmail } from "./beta-access";
import { utcDay } from "./platform-telemetry";
import { getSyncWorkerScope } from "./steam-sync-state";
import { readAdminAiSpend } from "./admin-ai-spend";

const DAY = 86_400_000;
export function dashboardDays(value: unknown): 7 | 30 | 90 {
  return value === "7" ? 7 : value === "90" ? 90 : 30;
}

export async function getAdminDashboard(userId: string, days: 7 | 30 | 90, now = new Date()) {
  // Authorize before every aggregate, including calls outside the admin page.
  const viewer = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!viewer || !isAdminEmail(viewer.email)) throw new Error("ADMIN_REQUIRED");

  const today = utcDay(now);
  const since = new Date(today.getTime() - (days - 1) * DAY);
  const week = new Date(today.getTime() - 6 * DAY);
  const month = new Date(today.getTime() - 29 * DAY);
  const range = { gte: since, lte: now };
  const workerScope = getSyncWorkerScope();
  const environment = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";
  const failedSync = { workerScope, status: "FAILED" as const, updatedAt: range };
  const failedImport = { status: "FAILED" as const, updatedAt: range };
  const failedAi = { error: { not: null }, createdAt: range };

  // A consistent read snapshot; only aggregates and bounded recent lists leave PostgreSQL.
  return prisma.$transaction(async (db) => {
    // Prisma qualifies model queries, but raw SQL needs the same configured schema.
    // Transaction-local and identifier-quoted, including isolated QA schemas.
    const schema = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).searchParams.get("schema") ?? "public" : "public";
    await db.$queryRaw`SELECT set_config('search_path', quote_ident(${schema}), true)`;
    const [users, newUsers, onboarded, libraryUsers, games, newGames, additions,
      activity, series, syncStates, syncFailures, importFailures, rowFailures, aiFailures,
      serverFailures, recentSync, recentImports, recentAi, recentServer, recentGames,
      providers, openBugs, missingCovers, metadataQueue, aiSpend] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { createdAt: range } }),
      db.user.count({ where: { onboardingCompletedAt: { not: null } } }),
      db.user.count({ where: { gameEntries: { some: {} } } }),
      db.game.count(),
      db.game.count({ where: { createdAt: range } }),
      db.$queryRaw<[{ count: number }]>`SELECT COUNT(*)::int AS count FROM (
        SELECT "userId", "gameId" FROM "UserGameEntry" GROUP BY "userId", "gameId"
        HAVING MIN("createdAt") >= ${since} AND MIN("createdAt") <= ${now}
      ) entries`,
      db.$queryRaw<[{ dau: number; wau: number; mau: number; firstDay: Date | null }]>`
        SELECT COUNT(DISTINCT "userId") FILTER (WHERE day = ${today})::int AS dau,
          COUNT(DISTINCT "userId") FILTER (WHERE day >= ${week} AND day <= ${today})::int AS wau,
          COUNT(DISTINCT "userId") FILTER (WHERE day >= ${month} AND day <= ${today})::int AS mau,
          (SELECT MIN(day) FROM "UserDailyActivity") AS "firstDay"
        FROM "UserDailyActivity" WHERE day >= ${month} AND day <= ${today}`,
      db.$queryRaw<Array<{ day: Date; users: number; games: number; active: number }>>`
        SELECT day, SUM(users)::int AS users, SUM(games)::int AS games, SUM(active)::int AS active FROM (
          SELECT date_trunc('day', "createdAt") AS day, COUNT(*) AS users, 0 AS games, 0 AS active
            FROM "User" WHERE "createdAt" >= ${since} AND "createdAt" <= ${now} GROUP BY 1
          UNION ALL SELECT date_trunc('day', "createdAt"), 0, COUNT(*), 0
            FROM "Game" WHERE "createdAt" >= ${since} AND "createdAt" <= ${now} GROUP BY 1
          UNION ALL SELECT day, 0, 0, COUNT(*) FROM "UserDailyActivity"
            WHERE day >= ${since} AND day <= ${today} GROUP BY day
        ) daily GROUP BY day ORDER BY day`,
      db.platformSyncRun.groupBy({ by: ["status"], where: { workerScope, createdAt: range }, _count: true }),
      db.platformSyncRun.count({ where: failedSync }),
      db.importJob.count({ where: failedImport }),
      db.importRow.count({ where: { outcome: "FAILED", job: { updatedAt: range } } }),
      db.assistantRun.count({ where: failedAi }),
      db.platformError.count({ where: { environment, createdAt: range } }),
      db.platformSyncRun.findMany({ where: failedSync, select: { id: true, provider: true, errorCode: true, updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 8 }),
      db.importJob.findMany({ where: failedImport, select: { id: true, updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 8 }),
      db.assistantRun.findMany({ where: failedAi, select: { id: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 8 }),
      db.platformError.findMany({ where: { environment, createdAt: range }, select: { id: true, route: true, kind: true, fingerprint: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 8 }),
      db.game.findMany({ where: { createdAt: range }, select: { id: true, name: true, slug: true, createdAt: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 8 }),
      db.externalAccount.groupBy({ by: ["provider"], _count: true }),
      db.feedback.count({ where: { type: "BUG", status: { in: ["NEW", "IN_REVIEW", "WAITING"] } } }),
      db.game.count({ where: { OR: [{ coverUrl: null }, { coverUrl: "" }] } }),
      db.gameMetadataJob.count({ where: { workerScope } }),
      readAdminAiSpend(db, since, now, today),
    ]);
    const daily = Array.from({ length: days }, (_, index) => {
      const day = new Date(since.getTime() + index * DAY);
      const row = series.find((item) => item.day.getTime() === day.getTime());
      return { day, users: row?.users ?? 0, games: row?.games ?? 0,
        active: activity[0].firstDay && day >= activity[0].firstDay ? row?.active ?? 0 : null };
    });
    return { now, since, days, workerScope, environment, users, newUsers, onboarded, libraryUsers,
      games, newGames, additions: additions[0].count, activity: activity[0], daily,
      syncStates, syncFailures, importFailures, rowFailures, aiFailures, serverFailures,
      recentSync, recentImports, recentAi, recentServer, recentGames, providers, openBugs, missingCovers, metadataQueue, aiSpend };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30_000 });
}

export type AdminDashboardData = Awaited<ReturnType<typeof getAdminDashboard>>;
