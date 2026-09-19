import { normalizeLibraryStatus } from "../../src/lib/library-status";
import assert from "node:assert/strict";
import { Prisma, UserGameStatus } from "@prisma/client";
import { prisma as db } from "../../src/lib/prisma";
import { setLibraryEntryStatus, setInferredLibraryCompletion, upsertLibraryCopy, syncLibraryCopy } from "../../src/lib/library-entry";
import { readGameDetail } from "../../src/lib/game-detail-queries";
import { migrateLibraryStatus } from "../library-status-migration";

const schema = new URL(process.env.DATABASE_URL!).searchParams.get("schema") ?? "";
assert.match(schema, /^steam_sync_test_[a-f0-9]{16}$/);
const table = Prisma.raw(`"${schema}"."UserGameEntry"`);

async function main() {
  const user = await db.user.create({ data: { displayName: "Library regression fixture" } });
  const other = await db.user.create({ data: { displayName: "Other player" } });
  const game = await db.game.create({ data: { name: "Library fixture", slug: "library-fixture", normalizedName: "libraryfixture" } });
  const account = await db.externalAccount.create({ data: { userId: user.id, provider: "STEAM", providerAccountId: "library-regression" } });
  const base = { userId: user.id, gameId: game.id };
  // Reproduce the old schema and a newer sync row beside an older manual choice.
  await db.$executeRaw`DROP INDEX ${Prisma.raw(`"${schema}"."UserGameEntry_userId_gameId_platformKey_key"`)}`;
  await db.$executeRaw`CREATE UNIQUE INDEX "UserGameEntry_userId_gameId_status_key" ON ${table}("userId", "gameId", "status")`;
  const steam = await db.userGameEntry.create({ data: { ...base, status: "OWNED", source: "STEAM", provider: "STEAM", platformName: "Steam", externalAccountId: account.id, playtimeMinutes: 90, notes: "Imported note", updatedAt: new Date("2026-09-19") } });
  const duplicate = await db.userGameEntry.create({ data: { ...base, status: "DROPPED", source: "MANUAL", platformName: "PC (Microsoft Windows)", notes: "Personal note", playtimeMinutes: 777, playtimeSource: "manual", isFavorite: true, abandonedAt: new Date("2026-09-18"), updatedAt: new Date("2026-09-18") } });
  await db.userGameEntry.create({ data: { ...base, status: "BACKLOG", source: "MANUAL", platformName: "PlayStation 5", playtimeMinutes: 15, updatedAt: new Date("2026-09-17") } });
  const otherEntry = await db.userGameEntry.create({ data: { userId: other.id, gameId: game.id, status: "OWNED", source: "MANUAL", platformName: "PC" } });
  const day = new Date("2026-09-10");
  await db.calendarSession.createMany({ data: [{ entryId: steam.id, day, minutes: 30 }, { entryId: duplicate.id, day, minutes: 60 }] });
  const originalJournal = await db.gameJournalEntry.create({ data: { ...base, userGameEntryId: steam.id, externalSourceId: "same-import", body: "Original memory" } });
  const journal = await db.gameJournalEntry.create({ data: { ...base, userGameEntryId: duplicate.id, externalSourceId: "same-import", body: "Personal memory" } });
  const media = await db.journalMedia.create({ data: { journalEntryId: journal.id, kind: "image", url: "/fixture.png", storageKey: "fixture", mimeType: "image/png" } });
  const review = await db.userGameReview.create({ data: { ...base, userGameEntryId: duplicate.id, body: "Preserve this review" } });
  const unknownGame = await db.game.create({ data: { name: "Unknown fixture", slug: "unknown-fixture", normalizedName: "unknownfixture" } });
  await db.userGameEntry.createMany({ data: [
    { userId: user.id, gameId: unknownGame.id, status: "OWNED", source: "STEAM", provider: "STEAM", platformName: "Steam" },
    { userId: user.id, gameId: unknownGame.id, status: "COMPLETED", source: "MANUAL", finishedAt: day },
  ] });

  // Ensure additive DDL is exercised too, not just consolidation.
  await db.$executeRaw`ALTER TABLE ${table} DROP COLUMN "platformKey", DROP COLUMN "statusChangedAt"`;
  const migration = await migrateLibraryStatus(db, schema);
  assert.equal(migration.merged, 2);
  let copies = await db.userGameEntry.findMany({ where: base });
  assert.equal(copies.length, 2, "only different platforms retain separate copies");
  assert.deepEqual(copies.map(e => e.platformKey).sort(), ["pc", "ps5"]);
  assert.ok(copies.every(e => e.status === "DROPPED" && e.statusChangedAt));
  const pc = copies.find(e => e.platformKey === "pc")!;
  assert.equal(pc.playtimeMinutes, 777);
  assert.equal(pc.isFavorite, true);
  assert.match(pc.notes!, /Imported note/);
  assert.match(pc.notes!, /Personal note/);
  assert.ok((pc.rawData as Prisma.JsonObject).catalogMergeArchive);
  assert.equal((await db.gameJournalEntry.findUniqueOrThrow({ where: { id: journal.id } })).userGameEntryId, pc.id);
  assert.equal((await db.gameJournalEntry.findUniqueOrThrow({ where: { id: originalJournal.id } })).userGameEntryId, pc.id);
  assert.ok(await db.journalMedia.findUnique({ where: { id: media.id } }));
  assert.equal((await db.userGameReview.findUniqueOrThrow({ where: { id: review.id } })).userGameEntryId, pc.id);
  assert.equal((await db.calendarSession.findUniqueOrThrow({ where: { entryId_day: { entryId: pc.id, day } } })).minutes, 60);
  assert.equal(await db.userGameEntry.count({ where: { userId: user.id, gameId: unknownGame.id } }), 1);
  assert.equal((await migrateLibraryStatus(db, schema)).alreadyApplied, true);
  console.log("PASS legacy migration: same-platform and unspecified duplicates, different platforms, latest personal status, notes, manual hours, journal/media, review, daily totals, idempotency.");

  for (const status of Object.values(UserGameStatus)) {
    await setLibraryEntryStatus(user.id, pc.id, status);
    copies = await db.userGameEntry.findMany({ where: base });
    assert.ok(copies.every(e => e.status === normalizeLibraryStatus(status)));
    assert.ok(copies.every(e => Boolean(e.finishedAt) === (status === "COMPLETED")));
    assert.ok(copies.every(e => Boolean(e.abandonedAt) === (status === "DROPPED")));
    const detail = await readGameDetail(db, game.slug, user.id);
    assert.equal(detail?.userEntries[0]?.status, normalizeLibraryStatus(status), "detail and catalog read the persisted choice");
  }
  assert.equal(await setLibraryEntryStatus(other.id, pc.id, "COMPLETED"), false);
  assert.equal(await setInferredLibraryCompletion(user.id, pc.id, new Date()), false, "achievement detection must preserve the explicit dropped choice");
  assert.equal((await db.userGameEntry.findUniqueOrThrow({ where: { id: otherEntry.id } })).status, "OWNED");
  const manualInput = { ...base, status: "PLAYING" as const, explicitStatus: true, platformName: "PC", create: { source: "MANUAL" as const }, update: {} };
  await Promise.all([1, 2, 3].map(() => upsertLibraryCopy(manualInput)));
  assert.equal(await db.userGameEntry.count({ where: base }), 2);
  const ps5 = copies.find(e => e.platformKey === "ps5")!;
  const sync = () => syncLibraryCopy({ ...base, accountId: account.id, provider: "STEAM", source: "STEAM", game: { providerGameId: "fixture", title: "Library fixture", platformName: "Steam", playtimeMinutes: 120 } });
  await Promise.all([sync(), setLibraryEntryStatus(user.id, ps5.id, "COMPLETED"), sync()]);
  await sync();
  copies = await db.userGameEntry.findMany({ where: base });
  assert.equal(copies.length, 2);
  assert.ok(copies.every(e => e.status === "COMPLETED"));
  assert.equal(copies.find(e => e.platformKey === "ps5")!.playtimeMinutes, 15, "platform progress stays separate");
  assert.equal(copies.find(e => e.platformKey === "pc")!.playtimeMinutes, 777);
  assert.equal(copies.find(e => e.platformKey === "pc")!.pendingPlaytimeMinutes, 120);
  // A subsequent import onto a newly purchased platform inherits the same status.
  const added = await upsertLibraryCopy({ ...base, platformName: "Nintendo Switch", status: "OWNED", create: { source: "CSV" }, update: {} });
  assert.equal(added.status, "COMPLETED");
  assert.ok(added.finishedAt);
  const finishedDate = added.finishedAt.getTime();
  await setLibraryEntryStatus(user.id, added.id, "COMPLETED");
  assert.equal((await db.userGameEntry.findUniqueOrThrow({ where: { id: added.id } })).finishedAt?.getTime(), finishedDate, "repeated save must preserve the finish date");
  const gogAccount = await db.externalAccount.create({ data: { userId: user.id, provider: "GOG", providerAccountId: "library-gog-regression" } });
  await syncLibraryCopy({ ...base, accountId: gogAccount.id, provider: "GOG", source: "GOG", game: { providerGameId: "gog-fixture", title: "Library fixture", platformName: "GOG" } });
  assert.equal((await db.userGameEntry.findUniqueOrThrow({ where: { id: pc.id } })).provider, "STEAM", "GOG ownership refresh must preserve the progress source");
  await upsertLibraryCopy({ ...base, platformName: null, status: "OWNED", create: { source: "PHOTO" }, update: {} });
  assert.equal(await db.userGameEntry.count({ where: base }), 3, "missing platform does not create a fourth copy");
  await assert.rejects(syncLibraryCopy({ userId: other.id, gameId: game.id, accountId: account.id, provider: "STEAM", source: "STEAM", game: { providerGameId: "fixture", title: "Library fixture" } }), /ownership changed/);
  console.log("PASS every status, cross-surface reads, ownership, concurrent manual adds, concurrent/repeated sync, manual hours, platform progress and new-platform inheritance.");
}

main().finally(() => db.$disconnect()).catch(error => { console.error(error); process.exitCode = 1; });
