import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { AccountOwnershipConflict, linkExternalAccountForUser } from "../../src/lib/account-linking";
import { saveImportedReview } from "../../src/lib/review-persistence";
import { readGameDetail, readGameMetadata } from "../../src/lib/game-detail-queries";

// Run through run-steam-sync-check.mjs, which creates and removes a fresh schema.
assert.match(new URL(process.env.DATABASE_URL!).searchParams.get("schema") ?? "", /^steam_sync_test_[a-f0-9]{16}$/);
const db = new PrismaClient({ log: [{ emit: "event", level: "query" }] });
const queries: string[] = [];
db.$on("query", (event) => queries.push(event.query));

async function main() {
  const a = await db.user.create({ data: { displayName: "Player A" } });
  const b = await db.user.create({ data: { displayName: "Player B" } });
  for (const provider of ["STEAM", "XBOX", "PLAYSTATION", "GOG"] as const) {
    const input = {
      userId: a.id, provider, providerAccountId: `account-${provider}`,
      profile: { displayName: "Provider name" }, data: { metadata: { version: 1 } },
    };
    const account = await linkExternalAccountForUser(db, input);
    const otherBefore = await db.user.findUniqueOrThrow({ where: { id: b.id } });
    await assert.rejects(linkExternalAccountForUser(db, { ...input, userId: b.id }), AccountOwnershipConflict);
    assert.deepEqual(await db.externalAccount.findUniqueOrThrow({ where: { id: account.id } }), account);
    assert.deepEqual(await db.user.findUniqueOrThrow({ where: { id: b.id } }), otherBefore);
    const refreshed = await linkExternalAccountForUser(db, { ...input, data: { metadata: { version: 2 } } });
    assert.equal(refreshed.userId, a.id);
    assert.deepEqual(refreshed.metadata, { version: 2 });
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: a.id } })).displayName, "Player A");

    const concurrentId = `race-${provider}`;
    const raced = await Promise.allSettled([a, b].map((user) => linkExternalAccountForUser(db, {
      ...input, userId: user.id, providerAccountId: concurrentId,
    })));
    assert.equal(raced.filter((result) => result.status === "fulfilled").length, 1);
    const rejected = raced.find((result) => result.status === "rejected");
    assert.ok(rejected?.status === "rejected" && rejected.reason instanceof AccountOwnershipConflict);
    assert.equal(await db.externalAccount.count({ where: { provider, providerAccountId: concurrentId } }), 1);
    const sameOwner = await Promise.all([1, 2].map(() => linkExternalAccountForUser(db, {
      ...input, providerAccountId: `same-owner-${provider}`,
    })));
    assert.equal(sameOwner[0].id, sameOwner[1].id);
  }
  console.log("PASS all four providers: conflicts preserve both owners, concurrent connections have one winner, reconnects work.");

  const game = await db.game.create({ data: { name: "Shared title", slug: "shared-title", normalizedName: "sharedtitle" } });
  const entryA = await db.userGameEntry.create({ data: {
    userId: a.id, gameId: game.id, source: "MANUAL", status: "PLAYING", currentPlayingSlot: 1,
    notes: "Own note", rawData: { private: "PRIVATE_A_RAW" },
  } });
  const entryB = await db.userGameEntry.create({ data: {
    userId: b.id, gameId: game.id, source: "MANUAL", status: "OWNED", notes: "PRIVATE_B_NOTE",
  } });
  const reviewInput = {
    userId: b.id, userGameEntryId: entryB.id, gameId: game.id, provider: "STEAM" as const,
    externalReviewId: "old-review", data: { body: "PRIVATE_B_REVIEW" },
  };
  assert.equal(await saveImportedReview(db, reviewInput), true);
  const existingReview = await db.userGameReview.findFirstOrThrow({ where: { externalReviewId: "old-review" } });
  assert.equal(await saveImportedReview(db, { ...reviewInput, userId: a.id, userGameEntryId: entryA.id }), false);
  assert.deepEqual(await db.userGameReview.findUniqueOrThrow({ where: { id: existingReview.id } }), existingReview);
  assert.equal(await saveImportedReview(db, { ...reviewInput, userId: a.id, externalReviewId: "wrong-entry" }), false);
  assert.equal(await db.userGameReview.count({ where: { externalReviewId: "wrong-entry" } }), 0);
  assert.equal(await saveImportedReview(db, { ...reviewInput, data: { body: "PRIVATE_B_REFRESH" } }), true);
  const racedReviews = await Promise.all([entryA, entryB].map((entry) => saveImportedReview(db, {
    ...reviewInput, userId: entry.userId, userGameEntryId: entry.id, externalReviewId: "race-review",
  })));
  assert.deepEqual(racedReviews.toSorted(), [false, true]);
  console.log("PASS review writes preserve ownership, reject another user's entry and handle concurrent imports.");

  const otherEntryA = await db.userGameEntry.create({ data: {
    userId: a.id, gameId: game.id, source: "MANUAL", status: "PLAYING", platformKey: "ps5", platformName: "PlayStation 5", playtimeSource: "manual",
  } });
  await db.gameJournalEntry.createMany({ data: [
    { userId: a.id, gameId: game.id, userGameEntryId: entryA.id, title: "Selected entry memory", occurredAt: new Date("2026-01-01") },
    { userId: a.id, gameId: game.id, userGameEntryId: otherEntryA.id, title: "Other entry memory", occurredAt: new Date("2026-02-01") },
    { userId: b.id, gameId: game.id, userGameEntryId: entryB.id, title: "PRIVATE_B_JOURNAL" },
  ] });
  await db.userGameReview.createMany({ data: Array.from({ length: 25 }, (_, i) => ({
    userId: a.id, userGameEntryId: entryA.id, gameId: game.id, body: `Own review ${i}`,
  })) });
  for (let i = 0; i < 9; i++) {
    await db.user.create({ data: {
      displayName: `Neighbor ${i}`, email: `PRIVATE_EMAIL_${i}@example.test`, passwordHash: "PRIVATE_HASH",
      onboardingAnswers: { private: "PRIVATE_ONBOARDING" },
      gameEntries: { create: {
        gameId: game.id, status: "OWNED", source: "MANUAL", playtimeMinutes: 30,
        notes: "PRIVATE_NOTE", rawData: { private: "PRIVATE_RAW" },
      } },
    } });
  }
  const gameBefore = await db.game.findUniqueOrThrow({ where: { id: game.id } });
  queries.length = 0;
  const detail = await readGameDetail(db, game.slug, a.id);
  assert.ok(detail);
  assert.equal(detail.userEntries.length, 2);
  assert.ok(detail.userEntries.every((entry) => entry.userId === a.id));
  assert.equal(detail.userReviews.length, 20);
  assert.ok(detail.userReviews.every((review) => review.userId === a.id));
  assert.equal(detail.journalEntries.length, 1);
  assert.equal(detail.journalEntries[0].title, "Selected entry memory");
  assert.equal(detail.communityEntries.length, 6);
  assert.ok(detail.communityEntries.every((entry) => entry.user.displayName !== "Player A"));
  assert.doesNotMatch(JSON.stringify(detail), /PRIVATE_/);
  const anonymous = await readGameDetail(db, game.slug, null);
  assert.ok(anonymous);
  assert.deepEqual(anonymous.userEntries, []);
  assert.deepEqual(anonymous.userReviews, []);
  assert.deepEqual(anonymous.journalEntries, []);
  assert.equal(anonymous.communityEntries.length, 6);
  assert.doesNotMatch(JSON.stringify(anonymous), /PRIVATE_/);
  assert.ok(!queries.some((query) => /^\s*(INSERT|UPDATE|DELETE)\b/i.test(query)));
  assert.deepEqual(await db.game.findUniqueOrThrow({ where: { id: game.id } }), gameBefore);
  queries.length = 0;
  assert.deepEqual(await readGameMetadata(db, game.slug), { name: game.name, slug: game.slug, summary: null });
  assert.equal(queries.length, 1);
  assert.doesNotMatch(queries[0], /User|Journal|Review/);
  assert.equal(await readGameDetail(db, "missing-title", a.id), null);
  console.log("PASS game reads: isolated personal records, bounded community/reviews, correct latest memory, anonymous privacy, no writes, lightweight metadata.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => db.$disconnect());
