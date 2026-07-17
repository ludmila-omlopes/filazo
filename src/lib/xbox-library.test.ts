import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculateCompletionPercent,
  mergeXboxTitles,
  parseXboxDate,
} from "./xbox-library.ts";

test("calculates Xbox completion with the current precedence and clamps it", () => {
  assert.equal(calculateCompletionPercent({ progressPercentage: 47.6 }), 48);
  assert.equal(
    calculateCompletionPercent({ earnedAchievements: 3, totalAchievements: 10 }),
    30,
  );
  assert.equal(
    calculateCompletionPercent({ currentGamerscore: 500, maxGamerscore: 1_000 }),
    50,
  );
  assert.equal(calculateCompletionPercent({}), null);
  assert.equal(calculateCompletionPercent({ progressPercentage: 120 }), 100);
  assert.equal(calculateCompletionPercent({ progressPercentage: -4 }), 0);
});

test("merges Xbox title hub and achievement history records", () => {
  const lastPlayed = "2026-06-01T12:00:00.000Z";
  const games = mergeXboxTitles(
    [
      {
        titleId: 101,
        name: "Achievement Name",
        platform: "Durango",
        serviceConfigId: "history-scid",
        lastUnlock: "2026-07-01T12:00:00.000Z",
        earnedAchievements: 9,
        maxGamerscore: 1_000,
        currentGamerscore: 900,
      },
      {
        titleId: 202,
        name: "History Only",
        platform: "Durango",
      },
      {
        titleId: 303,
        name: "Windows Game",
        platform: "Windows.Desktop",
      },
      { name: "Missing ID" },
      { titleId: 404 },
    ],
    [
      {
        titleId: "101",
        name: "Title Hub Name",
        devices: ["Xbox Series"],
        serviceConfigId: "hub-scid",
        pfn: "example.pfn",
        achievement: { progressPercentage: 42 },
        titleHistory: { lastTimePlayed: lastPlayed },
      },
    ],
  );

  assert.equal(games.length, 3);
  const merged = games.find((game) => game.providerGameId === "titleId:101")!;
  assert.equal(merged.title, "Title Hub Name");
  assert.equal(merged.platformName, "Xbox Series");
  assert.equal(merged.completionPercent, 42);
  assert.equal(merged.lastPlayedAt?.toISOString(), lastPlayed);
  assert.deepEqual(merged.providerGameIds, [
    "titleId:101",
    "scid:hub-scid",
    "pfn:example.pfn",
    "scid:history-scid",
  ]);
  assert.equal(
    games.find((game) => game.title === "History Only")?.platformName,
    "Durango",
  );
  assert.equal(
    games.find((game) => game.title === "Windows Game")?.platformName,
    "Xbox / Windows",
  );
});

test("parses Xbox dates including the year-one sentinel", () => {
  assert.equal(
    parseXboxDate("2026-01-02T03:04:05.000Z")?.toISOString(),
    "2026-01-02T03:04:05.000Z",
  );
  assert.equal(
    parseXboxDate("0001-01-01T00:00:00Z")?.toISOString(),
    "0001-01-01T00:00:00.000Z",
  );
  assert.equal(parseXboxDate(123), null);
});
