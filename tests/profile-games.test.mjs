import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseProfileGameSort,
  sortProfileGameEntries,
} from "../src/lib/profile-games.ts";

const entries = [
  createEntry("Older Long Game", "2026-01-01T00:00:00.000Z", 500),
  createEntry("Newest Zero Playtime", "2026-05-22T00:00:00.000Z", 0),
  createEntry("Alphabetical First", "2026-02-01T00:00:00.000Z", 10),
];

test("games default to lifecycle sorting with playing next after playing", () => {
  assert.equal(parseProfileGameSort(undefined), "status");

  const sorted = sortProfileGameEntries([
    createEntry("Owned", "2026-05-01T00:00:00.000Z", 0, "OWNED"),
    createEntry("Dropped", "2026-05-02T00:00:00.000Z", 0, "DROPPED"),
    createEntry("Playing", "2026-01-01T00:00:00.000Z", 20, "PLAYING"),
    createEntry(
      "Playing next",
      "2026-02-01T00:00:00.000Z",
      0,
      "PLAYING_NEXT",
    ),
    createEntry("Backlog", "2026-03-01T00:00:00.000Z", 0, "BACKLOG"),
    createEntry("Wishlist", "2026-04-01T00:00:00.000Z", 0, "WISHLIST"),
    createEntry("Completed", "2026-06-01T00:00:00.000Z", 300, "COMPLETED"),
  ], "status");

  assert.deepEqual(
    sorted.map((entry) => entry.game.name),
    [
      "Playing",
      "Playing next",
      "Completed",
      "Backlog",
      "Wishlist",
      "Owned",
      "Dropped",
    ],
  );
});

test("games can still be sorted by playtime or title", () => {
  assert.deepEqual(
    sortProfileGameEntries(entries, "playtime").map((entry) => entry.game.name),
    ["Older Long Game", "Alphabetical First", "Newest Zero Playtime"],
  );
  assert.deepEqual(
    sortProfileGameEntries(entries, "title").map((entry) => entry.game.name),
    ["Alphabetical First", "Newest Zero Playtime", "Older Long Game"],
  );
});

function createEntry(
  name,
  createdAt,
  playtimeMinutes,
  status = "OWNED",
  finishedAt = null,
) {
  return {
    createdAt: new Date(createdAt),
    finishedAt,
    playtimeMinutes,
    status,
    game: {
      name,
    },
  };
}
