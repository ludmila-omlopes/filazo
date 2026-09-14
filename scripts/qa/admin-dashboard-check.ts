import assert from "node:assert/strict";
import { prisma as db } from "../../src/lib/prisma";
import { dashboardDays, getAdminDashboard } from "../../src/lib/admin-dashboard";
import { recordDailyActivity, recordPlatformError, utcDay } from "../../src/lib/platform-telemetry";
import { ADMIN_EMAIL } from "../../src/lib/beta-access";

async function main() {
  assert.match(new URL(process.env.DATABASE_URL!).searchParams.get("schema") ?? "", /^steam_sync_test_[a-f0-9]{16}$/);
  const now = new Date();
  const today = utcDay(now);
  const before = new Date(today.getTime() - 10 * 86_400_000);
  const yesterday = new Date(today.getTime() - 86_400_000);
  const admin = await db.user.create({ data: { email: ADMIN_EMAIL, createdAt: before } });
  const user = await db.user.create({ data: { email: "dashboard-fixture@example.invalid", onboardingCompletedAt: now, createdAt: yesterday } });
  await assert.rejects(getAdminDashboard(user.id, 7), /ADMIN_REQUIRED/);
  await assert.rejects(getAdminDashboard("missing", 7), /ADMIN_REQUIRED/);
  assert.equal(dashboardDays("90"), 90);
  assert.equal(dashboardDays("7"), 7);
  assert.equal(dashboardDays("500"), 30);
  assert.equal(dashboardDays(["90"]), 30);
  assert.equal(utcDay(new Date("2026-09-14T23:59:59-03:00")).toISOString(), "2026-09-15T00:00:00.000Z");
  const empty = await getAdminDashboard(admin.id, 7, now);
  assert.equal(empty.activity.firstDay, null);
  assert(empty.daily.every(d => d.active === null));
  await Promise.all(Array.from({ length: 12 }, () => recordDailyActivity(user.id, now)));
  await recordDailyActivity(user.id, yesterday);
  await recordDailyActivity(admin.id, before);
  assert.equal(await db.userDailyActivity.count({ where: { userId: user.id } }), 2);
  const game = await db.game.create({ data: { name: "Dashboard fixture", slug: "dashboard-fixture", normalizedName: "dashboard fixture", createdAt: yesterday } });
  const oldGame = await db.game.create({ data: { name: "Older fixture", slug: "older-fixture", normalizedName: "older fixture", createdAt: before } });
  await db.userGameEntry.createMany({ data: [
    { userId: user.id, gameId: game.id, status: "OWNED", source: "MANUAL", createdAt: yesterday },
    { userId: user.id, gameId: game.id, status: "BACKLOG", source: "MANUAL", createdAt: yesterday },
    { userId: user.id, gameId: oldGame.id, status: "OWNED", source: "MANUAL", createdAt: before },
    { userId: user.id, gameId: oldGame.id, status: "BACKLOG", source: "MANUAL", createdAt: yesterday },
  ] });
  const account = await db.externalAccount.create({ data: { userId: user.id, provider: "STEAM", providerAccountId: "dashboard-fixture" } });
  await db.platformSyncRun.createMany({ data: [
    { externalAccountId: account.id, provider: "STEAM", trigger: "MANUAL", status: "FAILED", workerScope: "test", errorCode: "AUTH", createdAt: yesterday, updatedAt: yesterday },
    { externalAccountId: account.id, provider: "STEAM", trigger: "MANUAL", status: "FAILED", workerScope: "production", createdAt: yesterday, updatedAt: yesterday },
  ] });
  const job = await db.importJob.create({ data: { userId: user.id, fileName: "private-file.csv", status: "COMPLETED", createdAt: yesterday, updatedAt: yesterday } });
  await db.importRow.create({ data: { jobId: job.id, rowIndex: 1, rawData: {}, outcome: "FAILED", error: "private import content" } });
  await db.assistantRun.create({ data: { userId: user.id, inputSummary: {}, outputSummary: {}, status: "FAILED", error: "private prompt", createdAt: yesterday } });
  await recordPlatformError(new Error("secret token never persisted"), { routePath: "/games/[slug]?token=secret", routeType: "render" });
  const savedError = await db.platformError.findFirstOrThrow();
  assert.equal(savedError.route, "/games/[slug]");
  assert(!JSON.stringify(savedError).includes("secret"));
  await db.platformError.create({ data: { route: "/ignored", kind: "route", fingerprint: "x", environment: "production" } });
  const data = await getAdminDashboard(admin.id, 7);
  assert.equal(data.users, 2);
  assert.equal(data.newUsers, 1);
  assert.equal(data.games, 2);
  assert.equal(data.newGames, 1);
  assert.equal(data.additions, 1);
  assert.equal(data.libraryUsers, 1);
  assert.equal(data.onboarded, 1);
  assert.equal(data.activity.dau, 1);
  assert.equal(data.activity.wau, 1);
  assert.equal(data.activity.mau, 2);
  assert.equal(data.syncFailures, 1);
  assert.equal(data.importFailures, 0);
  assert.equal(data.rowFailures, 1);
  assert.equal(data.aiFailures, 1);
  assert.equal(data.serverFailures, 1);
  assert.equal(data.daily.reduce((sum, d) => sum + (d.active ?? 0), 0), 2);
  assert(!JSON.stringify(data).includes("private prompt"));
  assert(!JSON.stringify(data).includes("private-file"));
  assert.equal((await getAdminDashboard(admin.id, 90)).daily.length, 90);
  await db.platformError.createMany({ data: Array.from({ length: 12 }, () => ({ route: "/fixture", kind: "route", fingerprint: "x", environment: "test" })) });
  assert.equal((await getAdminDashboard(admin.id, 7)).recentServer.length, 8);
  process.env.AI_ESTIMATED_INPUT_USD_PER_1M_TOKENS = "1";
  process.env.AI_ESTIMATED_OUTPUT_USD_PER_1M_TOKENS = "2";
  const budgetInput = (usd: number, additionalCostUsd = 0) => ({
    kind: "ai_budget", feature: "assistant_chat", estimatedUsage: { usd, additionalCostUsd },
  });
  await db.assistantRun.createMany({ data: [
    { userId: user.id, status: "AI_BUDGET_USED", createdAt: new Date(), inputSummary: budgetInput(9, 0.05), outputSummary: { output: { inputTokens: 1000, outputTokens: 2000, privateText: "do not expose" } } },
    { userId: user.id, status: "AI_BUDGET_USED", createdAt: yesterday, inputSummary: budgetInput(2), outputSummary: {} },
    { userId: user.id, status: "AI_BUDGET_USED", createdAt: yesterday, inputSummary: budgetInput(9, 0.03), outputSummary: { output: { usage: { inputTokens: 0, outputTokens: 0 } } } },
    { userId: user.id, status: "AI_BUDGET_RESERVED", createdAt: yesterday, inputSummary: budgetInput(5), outputSummary: {} },
    { userId: user.id, status: "AI_BUDGET_FAILED", createdAt: yesterday, inputSummary: budgetInput(3), outputSummary: {} },
    { userId: user.id, status: "COMPLETED_CHAT_AI", createdAt: yesterday, inputSummary: budgetInput(999), outputSummary: {} },
    { userId: user.id, status: "AI_BUDGET_USED", createdAt: before, inputSummary: budgetInput(777), outputSummary: {} },
    { userId: user.id, status: "AI_BUDGET_USED", createdAt: new Date(now.getTime() + 86_400_000), inputSummary: budgetInput(888), outputSummary: {} },
    ...Array.from({ length: 501 }, () => ({ userId: user.id, status: "AI_BUDGET_USED", createdAt: yesterday, inputSummary: budgetInput(0), outputSummary: {} })),
  ] });
  const spend = (await getAdminDashboard(admin.id, 7)).aiSpend;
  assert(Math.abs(spend.usedUsd - 2.085) < 1e-9);
  assert(Math.abs(spend.todayUsd - 0.055) < 1e-9);
  assert.equal(spend.reservedUsd, 5);
  assert.equal(spend.failedUsd, 3);
  assert.equal(spend.usedRuns, 504);
  assert.equal(spend.features.length, 1);
  assert.equal(spend.features[0].usedUsd, spend.usedUsd);
  assert(!JSON.stringify(spend).includes("do not expose"));
  console.log("PASS AI costs: reported tokens, zero usage, fallback, extra costs, separate reservations/failures, period bounds, no diagnostic double counting and pagination beyond 500 records.");
  await db.user.delete({ where: { id: user.id } });
  assert.equal(await db.userDailyActivity.count({ where: { userId: user.id } }), 0);
  await recordDailyActivity("missing-user"); // Failed telemetry remains non-fatal.
  console.log("PASS admin authorization, empty state, UTC boundaries, concurrent daily deduplication, distinct library additions, periods, error privacy, environment isolation, list bounds and deletion cascade.");
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
