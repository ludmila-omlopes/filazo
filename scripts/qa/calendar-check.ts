import assert from "node:assert/strict";
import { prisma } from "../../src/lib/prisma";
import { readCalendar, refreshCalendar, runDailyCalendars } from "../../src/lib/calendar";
import { saveCalendarMinutes, saveCalendarStart, setCalendarRelease } from "../../src/lib/calendar-writes";
import { runReleaseDateSearch } from "../../src/lib/calendar-release-worker";
import { DAY_MS, utcDay } from "../../src/lib/calendar-policy";

async function main() {
  const schema = new URL(process.env.DATABASE_URL!).searchParams.get("schema");
  if (!schema || !/^steam_sync_test_[a-f0-9]{16}$/.test(schema)) throw new Error("An isolated QA schema is required.");
  const now = new Date();
  const start = new Date(now.getTime() - 14 * DAY_MS);
  const [alice, bob] = await Promise.all([prisma.user.create({ data: { displayName: "Calendar Alice" } }), prisma.user.create({ data: { displayName: "Calendar Bob" } })]);
  const game = await prisma.game.create({ data: { name: "Calendar campaign", normalizedName: "calendar campaign", slug: "calendar-campaign", hltbMainStoryMinutes: 1200 } });
  const makeEntry = (userId: string) => prisma.userGameEntry.create({ data: { userId, gameId: game.id, status: "PLAYING", source: "MANUAL", manualStartedAt: start, currentPlayingSlot: 1, playtimeMinutes: 600, playtimeSource: "calendar" } });
  const [entry, other] = await Promise.all([makeEntry(alice.id), makeEntry(bob.id)]);
  await prisma.playObservation.createMany({ data: [
    { entryId: entry.id, day: utcDay(start), observedAt: start, totalMinutes: 0, source: "calendar" },
    { entryId: entry.id, day: utcDay(new Date(now.getTime() - 7 * DAY_MS)), observedAt: new Date(now.getTime() - 7 * DAY_MS), totalMinutes: 300, source: "calendar" },
  ] });

  const concurrent = await Promise.all(Array.from({ length: 5 }, () => refreshCalendar(alice.id, "manual", now)));
  assert.equal(concurrent.filter((item) => item.refreshed).length, 1);
  assert.equal((await refreshCalendar(alice.id, "automatic", now)).refreshed, true);
  assert.equal((await refreshCalendar(alice.id, "automatic", now)).refreshed, false);
  assert.equal((await refreshCalendar(bob.id, "manual", now)).refreshed, true);
  const forecast = await prisma.calendarEstimate.findUniqueOrThrow({ where: { entryId: entry.id } });
  assert.equal(forecast.reason, "ready");
  assert.ok(forecast.estimatedFinish);
  assert.equal((await readCalendar(alice.id)).entries.some((e) => e.userId === bob.id), false);
  const beforeRead = forecast.calculatedAt;
  await readCalendar(alice.id);
  assert.deepEqual((await prisma.calendarEstimate.findUniqueOrThrow({ where: { entryId: entry.id } })).calculatedAt, beforeRead);
  console.log("PASS daily quotas, concurrency, independent automatic/manual updates and read-only page loads.");

  assert.equal(await saveCalendarStart(alice.id, other.id, start), false);
  assert.equal(await saveCalendarMinutes(alice.id, other.id, 30), false);
  assert.equal(await saveCalendarStart(alice.id, entry.id, new Date(Date.now() + DAY_MS)), false);
  assert.equal(await saveCalendarMinutes(alice.id, entry.id, 60, now), true);
  assert.equal(await saveCalendarMinutes(alice.id, entry.id, 60, now), true);
  assert.equal((await prisma.userGameEntry.findUniqueOrThrow({ where: { id: entry.id } })).playtimeMinutes, 660);
  await saveCalendarMinutes(alice.id, entry.id, 30, now);
  assert.equal((await prisma.userGameEntry.findUniqueOrThrow({ where: { id: entry.id } })).playtimeMinutes, 630);
  assert.equal((await prisma.userGameEntry.findUniqueOrThrow({ where: { id: other.id } })).playtimeMinutes, 600);
  console.log("PASS personal ownership and idempotent daily minute editing.");

  const release = await prisma.releaseAnnouncement.create({ data: { gameId: game.id, platform: "PC", region: "Worldwide", releaseDate: new Date("2099-10-03"), dateLabel: "2099-10-03", sourceUrl: "https://store.steampowered.com/app/123/test", checkedAt: now } });
  await Promise.all([setCalendarRelease(alice.id, release.id, true), setCalendarRelease(alice.id, release.id, true)]);
  await setCalendarRelease(bob.id, release.id, true);
  assert.equal(await prisma.userCalendarRelease.count({ where: { userId: alice.id } }), 1);
  await setCalendarRelease(alice.id, release.id, false);
  assert.equal(await prisma.userCalendarRelease.count({ where: { userId: bob.id } }), 1);
  await prisma.releaseAnnouncement.update({ where: { id: release.id }, data: { releaseDate: null, dateLabel: "TBA" } });
  assert.equal((await readCalendar(bob.id)).saved[0].release.releaseDate, null);
  assert.equal(await setCalendarRelease(alice.id, release.id, true), false);
  console.log("PASS personal subscriptions, deduplication and withdrawal of postponed release dates.");

  const tomorrow = new Date(now.getTime() + DAY_MS);
  assert.equal((await refreshCalendar(alice.id, "manual", tomorrow)).refreshed, true);
  const daily = await runDailyCalendars(tomorrow);
  assert.equal(daily.failed, 0);
  assert.ok(daily.updated >= 1);
  console.log("PASS UTC rollover and background updates without page visits.");

  const beforeFailure = await prisma.userCalendarState.findUniqueOrThrow({ where: { userId: alice.id } });
  const later = new Date(tomorrow.getTime() + DAY_MS);
  await prisma.$executeRawUnsafe(`ALTER TABLE "${schema}"."CalendarEstimate" ADD CONSTRAINT "calendar_test_failure" CHECK (false) NOT VALID`);
  await assert.rejects(() => refreshCalendar(alice.id, "manual", later));
  assert.deepEqual((await prisma.userCalendarState.findUniqueOrThrow({ where: { userId: alice.id } })).manualAt, beforeFailure.manualAt);
  assert.ok((await runDailyCalendars(later)).failed > 0);
  const retryState = await prisma.userCalendarState.findUniqueOrThrow({ where: { userId: alice.id } });
  assert.ok(retryState.retryAfter && retryState.retryAfter > later);
  assert.deepEqual(await runDailyCalendars(later), { updated: 0, failed: 0 });
  await prisma.$executeRawUnsafe(`ALTER TABLE "${schema}"."CalendarEstimate" DROP CONSTRAINT "calendar_test_failure"`);
  assert.equal((await refreshCalendar(alice.id, "manual", later)).refreshed, true);
  console.log("PASS failed refresh rollback preserves the manual allowance.");

  process.env.OPENAI_API_KEY = "calendar-test-key";
  process.env.OPENROUTER_KEY = "";
  process.env.OPENAI_BASE_URL = "https://api.openai.com/v1";
  process.env.AI_PROVIDER_BASE_URL = "";
  process.env.CALENDAR_RELEASE_SEARCH_ENABLED = "true";
  const originalFetch = globalThis.fetch;
  let searches = 0;
  const evidence = `${game.name} releases on PS5 on October 3, 2099.`;
  globalThis.fetch = async (input, init) => {
    if (String(input) === release.sourceUrl) return new Response(`<html><body><p>${evidence}</p></body></html>`, { headers: { "Content-Type": "text/html" } });
    assert.equal(String(input), "https://api.openai.com/v1/responses");
    const request = JSON.parse(String(init?.body));
    assert.equal(request.tools[0].type, "web_search");
    assert.ok(!JSON.stringify(request).includes(alice.id));
    searches++;
    return Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ releases: [{ title: game.name, platform: "PS5", region: "Worldwide", kind: "release_date", precision: "day", date: "2099-10-03", dateLabel: "2099-10-03", sourceUrl: release.sourceUrl, sourceType: "store", evidence }] }), annotations: [{ type: "url_citation", url: release.sourceUrl }] }] }], usage: { input_tokens: 50, output_tokens: 40 } });
  };
  try {
    const results = await Promise.all([runReleaseDateSearch(now), runReleaseDateSearch(now)]);
    assert.equal(searches, 1);
    assert.equal(results.filter((r) => r.status === "completed").length, 1);
    assert.equal(await prisma.game.count({ where: { normalizedName: game.normalizedName } }), 1);
    assert.equal(await prisma.releaseAnnouncement.count({ where: { gameId: game.id, platform: "PS5" } }), 1);
  } finally { globalThis.fetch = originalFetch; }
  console.log("PASS one global AI search per day, canonical game reuse and cited platform dates.");
}

main().finally(() => prisma.$disconnect());
