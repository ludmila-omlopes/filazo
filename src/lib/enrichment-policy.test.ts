import assert from "node:assert/strict";
import { test } from "node:test";
import {
  shouldSearchHltb,
  shouldSearchIgdb,
  shouldSearchMetacritic,
} from "./enrichment-policy.ts";

const NOW = new Date("2026-07-02T12:00:00.000Z");

test("new games search every enrichment provider", () => {
  assert.equal(shouldSearchIgdb(null), true);
  assert.equal(shouldSearchHltb(null, NOW), true);
  assert.equal(shouldSearchMetacritic(null, NOW), true);
});

test("fully enriched games skip fresh provider searches", () => {
  const game = createGame();

  assert.equal(shouldSearchIgdb(game), false);
  assert.equal(shouldSearchHltb(game, NOW), false);
  assert.equal(shouldSearchMetacritic(game, NOW), false);
});

test("IGDB search respects missing metadata attempt staleness", () => {
  assert.equal(
    shouldSearchIgdb(createGame({ coverUrl: null, igdbCheckedAt: daysAgo(2) }), NOW),
    false,
  );
  assert.equal(
    shouldSearchIgdb(createGame({ coverUrl: null, igdbCheckedAt: daysAgo(8) }), NOW),
    true,
  );
  assert.equal(
    shouldSearchIgdb(createGame({ coverUrl: null, igdbCheckedAt: null }), NOW),
    true,
  );
});

test("HLTB search skips complete estimates regardless of attempt age", () => {
  assert.equal(
    shouldSearchHltb(createGame({ hltbCheckedAt: daysAgo(100) }), NOW),
    false,
  );
});

test("HLTB search respects missing estimate attempt staleness", () => {
  assert.equal(
    shouldSearchHltb(
      createGame({
        hltbMainExtraMinutes: null,
        hltbCheckedAt: daysAgo(30),
      }),
      NOW,
    ),
    false,
  );
  assert.equal(
    shouldSearchHltb(
      createGame({
        hltbMainExtraMinutes: null,
        hltbCheckedAt: daysAgo(91),
      }),
      NOW,
    ),
    true,
  );
  assert.equal(
    shouldSearchHltb(
      createGame({
        hltbMainExtraMinutes: null,
        hltbCheckedAt: null,
      }),
      NOW,
    ),
    true,
  );
});

test("Metacritic search respects attempt staleness", () => {
  assert.equal(
    shouldSearchMetacritic(
      createGame({ metacriticScore: null, metacriticCheckedAt: daysAgo(10) }),
      NOW,
    ),
    false,
  );
  assert.equal(
    shouldSearchMetacritic(
      createGame({ metacriticScore: null, metacriticCheckedAt: daysAgo(31) }),
      NOW,
    ),
    true,
  );
});

function daysAgo(days: number) {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

function createGame(
  overrides: Partial<NonNullable<Parameters<typeof shouldSearchIgdb>[0]>> = {},
) {
  return {
    igdbId: 123,
    summary: "A game.",
    coverUrl: "https://example.com/cover.jpg",
    heroUrl: "https://example.com/hero.jpg",
    igdbCheckedAt: null,
    hltbMainStoryMinutes: 600,
    hltbMainExtraMinutes: 900,
    hltbCompletionistMinutes: 1200,
    hltbUpdatedAt: daysAgo(10),
    hltbCheckedAt: daysAgo(10),
    metacriticScore: 85,
    metacriticUpdatedAt: daysAgo(5),
    metacriticCheckedAt: daysAgo(5),
    ...overrides,
  };
}
