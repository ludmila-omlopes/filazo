import assert from "node:assert/strict";
import { prisma as db } from "../../src/lib/prisma";
import { resolveCatalogGame, enrichCatalogGame } from "../../src/lib/catalog";
import { igdbAdapter } from "../../src/lib/igdb";
import { hltbAdapter } from "../../src/lib/hltb";
import { metacriticAdapter } from "../../src/lib/metacritic";

assert.match(new URL(process.env.DATABASE_URL!).searchParams.get("schema") ?? "", /^steam_sync_test_[a-f0-9]{16}$/);
async function main() {
  const old = await db.game.create({ data: { name: "Portal", normalizedName: "portal", slug: "old-portal", igdbId: 14546 } });
  const modern = { name: "Portal", igdbId: 71, slug: "portal", summary: "Valve game", coverUrl: "https://example.test/cover", heroUrl: "https://example.test/hero", gameModes: ["Single player"] };
  igdbAdapter.searchBestMatch = async input => {
    assert.equal(input.provider, "STEAM"); assert.equal(input.providerGameId, "400");
    return modern;
  };
  const correct = await resolveCatalogGame({ title: "Portal", provider: "STEAM", providerGameId: "400", deferEnrichment: true });
  assert.notEqual(correct.id, old.id);
  assert.equal(correct.igdbId, 71);
  assert.equal((await db.game.findUniqueOrThrow({ where: { id: old.id } })).igdbId, 14546);
  assert.equal((await resolveCatalogGame({ title: "Portal", provider: "IGDB", providerGameId: "71", metadata: modern, deferEnrichment: true })).id, correct.id);

  // Weak HLTB identity must never override an exact provider/IGDB identity.
  await db.gameProviderLink.create({ data: { provider: "HLTB", providerGameId: "weak-title", gameId: old.id } });
  hltbAdapter.searchBestMatch = async () => ({ name: "Portal", hltbId: "weak-title", mainStoryMinutes: 60 });
  metacriticAdapter.searchBestMatch = async () => null;
  assert.equal((await resolveCatalogGame({ title: "Portal", provider: "IGDB", providerGameId: "71", metadata: modern })).id, correct.id);

  // Refresh with an established ID never invokes automatic name matching.
  igdbAdapter.searchBestMatch = async () => { throw new Error("Must not search by name"); };
  await db.game.update({ where: { id: correct.id }, data: { heroUrl: null, igdbCheckedAt: null } });
  await enrichCatalogGame(correct.id); // credentials are disabled; ID refresh degrades without changing identity.
  assert.equal((await db.game.findUniqueOrThrow({ where: { id: correct.id } })).igdbId, 71);

  // Missing metadata keeps imports usable but cannot adopt an identified homonym.
  igdbAdapter.searchBestMatch = async () => null;
  const unresolved = await resolveCatalogGame({ title: "Portal", provider: "STEAM", providerGameId: "other-app", deferEnrichment: true });
  assert.notEqual(unresolved.id, old.id); assert.notEqual(unresolved.id, correct.id);
  assert.equal(unresolved.igdbId, null);
  assert.equal((await resolveCatalogGame({ title: "Portal", provider: "STEAM", providerGameId: "other-app", deferEnrichment: true })).id, unresolved.id);
  console.log("PASS exact IDs, homonym separation, HLTB cannot redirect identity, refresh by ID, graceful metadata outage and repeat sync.");
}
main().finally(() => db.$disconnect()).catch(error => { console.error(error); process.exitCode = 1; });
