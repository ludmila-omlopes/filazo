import assert from "node:assert/strict";
import { prisma as db } from "../../src/lib/prisma";
import { removeLibraryEntry } from "../../src/lib/remove-library-entry";

const schema = new URL(process.env.DATABASE_URL!).searchParams.get("schema") ?? "";
assert.match(schema, /^steam_sync_test_[a-f0-9]{16}$/);

async function main() {
  const owner = await db.user.create({ data: { displayName: "Removal fixture" } });
  const other = await db.user.create({ data: { displayName: "Other player" } });
  const game = await db.game.create({ data: { name: "Removal fixture", slug: "removal-fixture", normalizedName: "removalfixture" } });
  const base = { userId: owner.id, gameId: game.id };
  const pc = await db.userGameEntry.create({ data: { ...base, source: "MANUAL", status: "PLAYING_NEXT", platformKey: "pc", playingNextSlot: 1 } });
  const ps = await db.userGameEntry.create({ data: { ...base, source: "MANUAL", status: "PLAYING_NEXT", platformKey: "ps5" } });
  const otherCopy = await db.userGameEntry.create({ data: { userId: other.id, gameId: game.id, source: "MANUAL", status: "OWNED" } });
  const page = await db.gameJournalEntry.create({ data: { ...base, userGameEntryId: pc.id, body: "Fixture diary" } });
  const review = await db.userGameReview.create({ data: { ...base, userGameEntryId: pc.id, body: "Fixture review" } });
  const day = new Date("2026-09-24");
  await db.calendarSession.create({ data: { entryId: pc.id, day, minutes: 20 } });

  assert.equal(await removeLibraryEntry(other.id, pc.id), false);
  assert.ok(await db.userGameEntry.findUnique({ where: { id: pc.id } }));
  assert.equal(await removeLibraryEntry(owner.id, pc.id), true);
  assert.equal(await db.userGameEntry.findUnique({ where: { id: pc.id } }), null);
  assert.equal(await db.gameJournalEntry.findUnique({ where: { id: page.id } }), null);
  assert.equal(await db.userGameReview.findUnique({ where: { id: review.id } }), null);
  assert.equal(await db.calendarSession.count({ where: { entryId: pc.id } }), 0);
  assert.ok(await db.userGameEntry.findUnique({ where: { id: ps.id } }));
  assert.ok(await db.userGameEntry.findUnique({ where: { id: otherCopy.id } }));
  assert.ok(await db.game.findUnique({ where: { id: game.id } }));
  assert.equal(await removeLibraryEntry(owner.id, pc.id), false);
  console.log("PASS removal: user isolation, selected platform only, canonical game preserved, diary/review/calendar cascade, repeated removal.");
}

main().finally(() => db.$disconnect()).catch(error => { console.error(error); process.exitCode = 1; });
