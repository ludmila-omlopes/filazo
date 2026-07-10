import assert from "node:assert/strict";
import { test } from "node:test";
import {
  orderPicksForMood,
  scoreMood,
} from "../src/lib/tonight-moods.ts";

test("short mood prefers low remaining time regardless of logged playtime", () => {
  const shortRemaining = createPick({
    entryId: "short-remaining",
    playtimeMinutes: 3000,
    remainingMinutes: 120,
  });
  const longRemaining = createPick({
    entryId: "long-remaining",
    playtimeMinutes: 10,
    remainingMinutes: 4000,
  });

  const ordered = orderPicksForMood(
    [longRemaining, shortRemaining],
    "short",
    "seed",
  );

  assert.equal(ordered[0].entryId, "short-remaining");
});

test("short mood ignores reason text and unknown remaining time", () => {
  assert.equal(
    scoreMood(createPick({ remainingMinutes: null }), "short"),
    0,
  );
  assert.equal(
    scoreMood(createPick({ playtimeMinutes: 10, remainingMinutes: null }), "short"),
    0,
  );
});

test("cozy and gripping moods read string and object genre arrays", () => {
  assert.equal(
    scoreMood(createPick({ genres: JSON.stringify(["Puzzle"]) }), "cozy"),
    2,
  );
  assert.equal(
    scoreMood(createPick({ genres: [{ name: "Horror" }] }), "gripping"),
    2,
  );
});

test("old-save mood prefers playing then played entries", () => {
  assert.equal(
    scoreMood(createPick({ status: "PLAYING", playtimeMinutes: 0 }), "old-save"),
    3,
  );
  assert.equal(
    scoreMood(createPick({ status: "BACKLOG", playtimeMinutes: 30 }), "old-save"),
    2,
  );
  assert.equal(
    scoreMood(createPick({ status: "BACKLOG", playtimeMinutes: 0 }), "old-save"),
    0,
  );
});

test("surprise mood is a seeded shuffle", () => {
  const picks = ["alpha", "bravo", "charlie", "delta", "echo"].map((entryId) =>
    createPick({ entryId }),
  );
  const seedA = orderPicksForMood(picks, "surprise", "user:2026-07-07").map(
    (pick) => pick.entryId,
  );
  const seedARepeat = orderPicksForMood(
    picks,
    "surprise",
    "user:2026-07-07",
  ).map((pick) => pick.entryId);
  const seedB = orderPicksForMood(picks, "surprise", "user:2026-07-08").map(
    (pick) => pick.entryId,
  );

  assert.deepEqual(seedA, seedARepeat);
  assert.notDeepEqual(seedA, seedB);
});

test("ordering is stable within the same seed", () => {
  const picks = ["one", "two", "three", "four", "five"].map((entryId) =>
    createPick({ entryId }),
  );

  assert.deepEqual(
    orderPicksForMood(picks, "surprise", "same-day"),
    orderPicksForMood(picks, "surprise", "same-day"),
  );
});

test("different mood seeds can surface different tie winners", () => {
  const picks = ["alpha", "bravo", "charlie", "delta", "echo"].map((entryId) =>
    createPick({ entryId, genres: [] }),
  );

  assert.notEqual(
    orderPicksForMood(picks, "surprise", "user:2026-07-07:short")[0].entryId,
    orderPicksForMood(picks, "surprise", "user:2026-07-07:cozy")[0].entryId,
  );
});

function createPick({
  entryId = "entry",
  status = "OWNED",
  playtimeMinutes = 0,
  remainingMinutes = 600,
  genres = [],
} = {}) {
  return {
    entryId,
    entry: {
      status,
      playtimeMinutes,
      remainingMinutes,
      game: {
        genres,
      },
    },
  };
}
