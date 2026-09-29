import assert from "node:assert/strict";
import test from "node:test";
import { isIndexableGame, looksLikeGameExtra, type IndexableGameSignals } from "./game-indexing.ts";

const richGame: IndexableGameSignals = {
  summary: "A lighthouse keeper pieces together a quiet island mystery across a handful of evenings, one tide and one letter at a time.",
  coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/example.jpg",
  screenshots: null,
  hltbMainStoryMinutes: 360,
  hltbMainExtraMinutes: null,
  hltbCompletionistMinutes: null,
  metacriticScore: null,
};

test("indexes game pages with a real synopsis, cover and one more catalog detail", () => {
  assert.equal(isIndexableGame(richGame), true);
  assert.equal(isIndexableGame({ ...richGame, hltbMainStoryMinutes: null, metacriticScore: 81 }), true);
  assert.equal(isIndexableGame({ ...richGame, hltbMainStoryMinutes: null, screenshots: ["https://example.com/1.jpg"] }), true);
});

test("keeps thin game pages out of the search index", () => {
  assert.equal(isIndexableGame({ ...richGame, summary: null }), false);
  assert.equal(isIndexableGame({ ...richGame, summary: "   Short stub.   " }), false);
  assert.equal(isIndexableGame({ ...richGame, coverUrl: null }), false);
  assert.equal(isIndexableGame({ ...richGame, hltbMainStoryMinutes: null }), false);
  assert.equal(isIndexableGame({ ...richGame, hltbMainStoryMinutes: null, screenshots: [] }), false);
  assert.equal(isIndexableGame({ ...richGame, hltbMainStoryMinutes: 0 }), false);
});

test("recognizes soundtrack and add-on catalog extras", () => {
  assert.equal(looksLikeGameExtra("Celeste Original Soundtrack"), true);
  assert.equal(looksLikeGameExtra("Hades - Season Pass DLC"), true);
  assert.equal(looksLikeGameExtra("Outer Wilds"), false);
});
