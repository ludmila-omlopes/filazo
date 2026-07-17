import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatPlayStationPlatform,
  isPlayStationNonGameCategory,
  mergePlayStationSyncedGames,
  parsePlayStationDurationMinutes,
} from "./playstation-library.ts";

test("parses PlayStation ISO durations", () => {
  assert.equal(parsePlayStationDurationMinutes("PT2H30M"), 150);
  assert.equal(parsePlayStationDurationMinutes("P1DT1H"), 1_500);
  assert.equal(parsePlayStationDurationMinutes("PT90S"), 2);
  assert.equal(parsePlayStationDurationMinutes("PT1,5H"), 90);
  assert.equal(parsePlayStationDurationMinutes("garbage"), null);
  assert.equal(parsePlayStationDurationMinutes(null), null);
});

test("merges purchased, trophy, and played records for one title", () => {
  const lastPlayedAt = new Date("2026-06-01T12:00:00.000Z");
  const [game] = mergePlayStationSyncedGames(
    [
      {
        providerGameId: "titleId:PPSA00001",
        providerGameIds: ["titleId:PPSA00001", "productId:UP0001"],
        title: "Example Game",
        platformName: "PlayStation PS5",
        rawData: { syncSource: "purchased-game" },
      },
    ],
    [
      {
        providerGameId: "npCommunicationId:NPWR00001_00",
        title: "Example Game",
        completionPercent: 73,
        rawData: { syncSource: "trophy-title" },
      },
    ],
    [
      {
        providerGameId: "titleId:PPSA00001",
        providerGameIds: ["titleId:PPSA00001", "conceptId:10001"],
        title: "Example Game",
        playtimeMinutes: 245,
        lastPlayedAt,
        rawData: { syncSource: "played-game" },
      },
    ],
  );

  assert.equal(game.providerGameId, "titleId:PPSA00001");
  assert.deepEqual(game.providerGameIds, [
    "titleId:PPSA00001",
    "productId:UP0001",
    "npCommunicationId:NPWR00001_00",
    "conceptId:10001",
  ]);
  assert.equal(game.completionPercent, 73);
  assert.equal(game.playtimeMinutes, 245);
  assert.equal(game.lastPlayedAt?.toISOString(), lastPlayedAt.toISOString());
  const sources = game.rawData?.playStationSyncSources as Array<{
    syncSource: string;
  }>;
  assert.deepEqual(
    sources.map((source) => source.syncSource),
    ["purchased-game", "trophy-title", "played-game"],
  );
});

test("keeps different PlayStation titles separate", () => {
  const games = mergePlayStationSyncedGames(
    [{ providerGameId: "titleId:one", title: "First Game" }],
    [{ providerGameId: "npCommunicationId:two", title: "Second Game" }],
    [],
  );

  assert.deepEqual(
    games.map((game) => game.title),
    ["First Game", "Second Game"],
  );
});

test("incoming null playtime overwrites an existing value", () => {
  const [game] = mergePlayStationSyncedGames(
    [
      {
        providerGameId: "titleId:one",
        title: "Example Game",
        playtimeMinutes: 120,
      },
    ],
    [],
    [
      {
        providerGameId: "titleId:one",
        title: "Example Game",
        playtimeMinutes: null,
      },
    ],
  );

  // characterization: an explicit null from a later source clears playtime.
  assert.equal(game.playtimeMinutes, null);
});

test("identifies PlayStation non-game categories", () => {
  assert.equal(isPlayStationNonGameCategory("ps4NonGameMediaApp"), true);
  assert.equal(isPlayStationNonGameCategory("ps5NativeGame"), false);
  assert.equal(isPlayStationNonGameCategory(null), false);
});

test("formats comma-separated PlayStation platforms", () => {
  assert.equal(
    formatPlayStationPlatform("PS4,PS5"),
    "PlayStation PS4, PlayStation PS5",
  );
});
