import assert from "node:assert/strict";
import { prisma as db } from "../../src/lib/prisma";
import { importCsvForUser } from "../../src/lib/catalog";
import { igdbAdapter } from "../../src/lib/igdb";
import { hltbAdapter } from "../../src/lib/hltb";
import { metacriticAdapter } from "../../src/lib/metacritic";
import { normalizeTitle } from "../../src/lib/utils";

assert.match(new URL(process.env.DATABASE_URL!).searchParams.get("schema") ?? "", /^steam_sync_test_[a-f0-9]{16}$/);

const stardew = {
  name: "Stardew Valley", igdbId: 17000, slug: "stardew-valley", summary: "Farming game",
  coverUrl: "https://example.test/stardew-cover", heroUrl: "https://example.test/stardew-hero", gameModes: ["Single player"],
};

async function main() {
  // Metadata search trusts whatever title the CSV row carries.
  igdbAdapter.searchBestMatch = async ({ title }) => (title === "Stardew Valley" ? stardew : null);
  hltbAdapter.searchBestMatch = async () => null;
  metacriticAdapter.searchBestMatch = async () => null;

  const user = await db.user.create({ data: { displayName: "CSV importer" } });
  // A real PlayStation sync linked this title before metadata enrichment ran.
  const astro = await db.game.create({ data: { name: "Astro Bot", normalizedName: normalizeTitle("Astro Bot"), slug: "astro-bot" } });
  await db.gameProviderLink.create({ data: { provider: "PLAYSTATION", providerGameId: "PPSA01234_00", gameId: astro.id, rawData: { source: "psn" } } });
  // An enriched title linked by a real sync.
  const hades = await db.game.create({ data: { name: "Hades", normalizedName: normalizeTitle("Hades"), slug: "hades", igdbId: 113112 } });
  await db.gameProviderLink.create({ data: { provider: "PLAYSTATION", providerGameId: "PPSA05555_00", gameId: hades.id, rawData: { source: "psn" } } });
  await db.game.create({ data: { name: stardew.name, normalizedName: normalizeTitle(stardew.name), slug: stardew.slug, igdbId: stardew.igdbId } });

  const linksBefore = await db.gameProviderLink.findMany({ orderBy: { id: "asc" } });
  const gamesBefore = await db.game.findMany({ orderBy: { id: "asc" } });

  const result = await importCsvForUser({
    userId: user.id,
    fileName: "forged.csv",
    mapping: { title: "Name", externalId: "Id", provider: "PLAYSTATION" },
    csvText: [
      "Name,Id",
      // Tries to rename or re-point a linked title that has no metadata yet.
      "Stardew Valley,PPSA01234_00",
      // Tries to re-point an enriched linked title.
      "Stardew Valley,PPSA05555_00",
      // Tries to pre-claim a PlayStation ID nobody has synced yet.
      "Visit evil.example,PPSA99999_00",
    ].join("\n"),
  });
  assert.equal(result.importedCount, 3);

  // Shared provider mappings and existing canonical games are untouched.
  assert.deepEqual(await db.gameProviderLink.findMany({ orderBy: { id: "asc" } }), linksBefore);
  const gamesAfter = await db.game.findMany({ where: { id: { in: gamesBefore.map((game) => game.id) } }, orderBy: { id: "asc" } });
  assert.deepEqual(gamesAfter, gamesBefore);
  assert.equal(await db.gameProviderLink.count({ where: { providerGameId: "PPSA99999_00" } }), 0);

  // The importer's own copies reuse trusted mappings; unknown IDs match by title only.
  const entries = await db.userGameEntry.findMany({ where: { userId: user.id }, include: { game: true } });
  assert.deepEqual(new Set(entries.map((entry) => entry.game.name)), new Set(["Astro Bot", "Hades", "Visit evil.example"]));
  const rows = await db.importRow.findMany({ orderBy: { rowIndex: "asc" } });
  assert.deepEqual(rows.map((row) => row.externalId), ["PPSA01234_00", "PPSA05555_00", "PPSA99999_00"]);
  console.log("PASS CSV provider IDs reuse trusted mappings read-only, never rename, re-point or pre-claim shared catalog identities.");
}
main().finally(() => db.$disconnect()).catch(error => { console.error(error); process.exitCode = 1; });
