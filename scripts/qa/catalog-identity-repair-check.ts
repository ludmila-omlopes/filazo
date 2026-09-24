import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { prisma as db } from "../../src/lib/prisma";
import { applyReportedIdentityRepair, captureRepairSnapshot, reportedIdentities, isProvenRe2RemakeEntry } from "../catalog-identity-repair";
import type { EnrichedGameMetadata } from "../../src/lib/providers/contracts";

assert.match(new URL(process.env.DATABASE_URL!).searchParams.get("schema") ?? "", /^steam_sync_test_[a-f0-9]{16}$/);
async function main() {
  const user = await db.user.create({ data: { displayName: "Repair fixture" } });
  const other = await db.user.create({ data: { displayName: "Other fixture" } });
  const account = await db.externalAccount.create({ data: { userId: user.id, provider: "STEAM", providerAccountId: "repair-fixture" } });
  const metadata = new Map<number, EnrichedGameMetadata>();
  for (const identity of reportedIdentities) {
    const game = await db.game.create({ data: { name: `Fixture ${identity.appId}`, slug: `fixture-${identity.appId}`, normalizedName: `fixture-${identity.appId}`, igdbId: identity.oldId,
      providerLinks: { create: [{ provider: "STEAM", providerGameId: identity.appId }, { provider: "IGDB", providerGameId: String(identity.oldId) }] } } });
    const entry = await db.userGameEntry.create({ data: { userId: user.id, gameId: game.id, source: "STEAM", provider: "STEAM", externalAccountId: account.id, platformKey: "pc", status: "COMPLETED", playtimeMinutes: 777, notes: "Keep my notes", isFavorite: true, finishedAt: new Date("2026-08-01"), statusChangedAt: new Date("2026-08-02"), rawData: { appid: Number(identity.appId) } } });
    await db.gameJournalEntry.create({ data: { userId: user.id, gameId: game.id, userGameEntryId: entry.id, body: "Keep my diary" } });
    await db.userGameReview.create({ data: { userId: user.id, gameId: game.id, userGameEntryId: entry.id, body: "Keep my review" } });
    await db.userGameProviderLink.create({ data: { userId: user.id, gameId: game.id, externalAccountId: account.id, provider: "STEAM", providerGameId: identity.appId } });
    if (identity.appId === "883710") {
      await db.userGameEntry.create({ data: { userId: other.id, gameId: game.id, source: "MANUAL", status: "OWNED", rawData: { igdbId: identity.oldId } } });
      await db.userGamePlayDate.create({ data: { userId: user.id, gameId: game.id, provider: "STEAM", day: new Date("2026-08-01"), kind: "last-played" } });
    }
    metadata.set(identity.correctId, { igdbId: identity.correctId, name: `Correct ${identity.appId}`, slug: `correct-${identity.appId}`, coverUrl: "https://example.test/cover", summary: "Correct fixture", releaseDate: new Date("2020-01-01") });
  }
  const before = await captureRepairSnapshot(db);
  // A changed record after backup must abort before any mutation.
  const modified = before.entries[0];
  await db.userGameEntry.update({ where: { id: modified.id }, data: { notes: "New note" } });
  await assert.rejects(applyReportedIdentityRepair(db, before, metadata), /changed after backup/);
  assert.equal((await db.game.findMany({ where: { igdbId: { in: reportedIdentities.map(i => i.correctId) } } })).length, 0);
  const snapshot = await captureRepairSnapshot(db);
  await applyReportedIdentityRepair(db, snapshot, metadata);
  const after = await captureRepairSnapshot(db);
  for (const original of snapshot.entries) {
    const updated = after.entries.find(entry => entry.id === original.id)!;
    assert.ok(updated);
    assert.deepEqual({ ...updated, gameId: original.gameId }, original, "All personal entry fields and timestamps preserved");
    if (original.userId === other.id) assert.equal(updated.gameId, original.gameId, "Original version stays separate");
    for (const [oldRecords, newRecords] of [[snapshot.journal, after.journal], [snapshot.reviews, after.reviews]]) {
      for (const old of oldRecords.filter(row => row.userGameEntryId === original.id)) {
        const current = newRecords.find(row => row.id === old.id)!;
        assert.equal(current.gameId, updated.gameId);
        assert.equal(current.body, old.body);
      }
    }
  }
  const modern = after.games.find(game => game.igdbId === 19686)!;
  assert.equal(after.playDates[0].gameId, modern.id);
  assert.equal(after.userLinks.find(link => link.providerGameId === "883710")?.gameId, modern.id);
  await applyReportedIdentityRepair(db, after, metadata);
  assert.deepEqual(await captureRepairSnapshot(db), after, "Repair is idempotent");

  const ps = (ids: string[], names: string[] = []) => ({ source: "PLAYSTATION", rawData: { playStationSyncSources: [...ids.map(npCommunicationId => ({ npCommunicationId })), ...names.map(name => ({ concept: { name } }))] } });
  assert.equal(isProvenRe2RemakeEntry(ps(["NPWR26027_00"])), true);
  assert.equal(isProvenRe2RemakeEntry(ps(["NPWR26027_00", "NPWR18248_00"])), false);
  assert.equal(isProvenRe2RemakeEntry(ps(["NPWR26027_00"], ["RESIDENT EVIL 3"])), false);
  assert.equal(isProvenRe2RemakeEntry({ source: "PHOTO", rawData: Prisma.JsonNull }), false);
  console.log("PASS repair backup drift guard, all five identities, preserved status/hours/notes/timestamps/diary/reviews, source links/dates, original kept separate, mixed PlayStation rejection and idempotency.");
}
main().finally(() => db.$disconnect()).catch(error => { console.error(error); process.exitCode = 1; });
