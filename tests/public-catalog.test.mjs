import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePublicCatalogParams, publicCatalogHref, readPublicCatalog } from "../src/lib/public-catalog.ts";

test("public catalog bounds user-controlled query size and pagination", () => {
  assert.deepEqual(parsePublicCatalogParams({ q: ["private", "other"], page: "-1" }), { q: "", page: 1 });
  for (const page of ["Infinity", "1e9", "99999999999999999999", "1.5", ["2", "3"]]) {
    assert.equal(parsePublicCatalogParams({ page }).page, 1);
  }
  assert.equal(parsePublicCatalogParams({ page: "9999" }).page, 1000);
  assert.equal(parsePublicCatalogParams({ q: "x".repeat(1000) }).q.length, 100);
});

test("anonymous catalog reads only public game fields with bounded stable pagination", async () => {
  const cards = Array.from({ length: 25 }, (_, i) => ({ name: `Game ${i}`, slug: `game-${i}`, coverUrl: null }));
  const db = { game: { findMany: async args => {
    assert.deepEqual(args.select, { slug: true, name: true, coverUrl: true });
    assert.deepEqual(args.orderBy, [{ normalizedName: "asc" }, { slug: "asc" }]);
    assert.equal(args.take, 25);
    assert.equal(args.skip, 24);
    assert.deepEqual(args.where, {});
    return cards;
  } } };
  const result = await readPublicCatalog(db, { page: "2" });
  assert.equal(result.games.length, 24);
  assert.equal(result.games.at(-1).slug, "game-23");
  assert.equal(result.hasNext, true);
});

test("search uses existing canonical normalization and retains non-Latin names", async () => {
  const queries = [];
  const db = { game: { findMany: async args => { queries.push(args.where); return []; } } };
  await readPublicCatalog(db, { q: "  Pokémon™  " });
  assert.deepEqual(queries[0].OR, [
    { name: { contains: "Pokémon™", mode: "insensitive" } },
    { normalizedName: { contains: "pokemon" } },
  ]);
  const empty = await readPublicCatalog(db, { q: "龍" });
  assert.deepEqual(queries[1].OR, [{ name: { contains: "龍", mode: "insensitive" } }]);
  assert.equal(empty.hasNext, false);
});

test("pagination links preserve searches and encode reserved characters", () => {
  const url = new URL(publicCatalogHref("Pokémon & friends", 2), "https://filazo.app");
  assert.equal(url.pathname, "/catalog");
  assert.equal(url.searchParams.get("q"), "Pokémon & friends");
  assert.equal(url.searchParams.get("page"), "2");
  assert.equal(publicCatalogHref(""), "/catalog");
});
