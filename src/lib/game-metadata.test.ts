import assert from "node:assert/strict";
import { test } from "node:test";
import { getSharedGameGenre, readStringList } from "./game-metadata.ts";

test("reads serialized game metadata lists", () => {
  assert.deepEqual(readStringList('["Puzzle", {"name":"Adventure"}]'), [
    "Puzzle",
    "Adventure",
  ]);
});

test("finds a genre shared by two selected games", () => {
  assert.deepEqual(
    getSharedGameGenre([
      { game: { genres: ["Puzzle", "Adventure"] } },
      { game: { genres: ["puzzle", "Platform"] } },
      { game: { genres: ["Racing"] } },
    ]),
    { count: 2, name: "Puzzle" },
  );
});

test("counts a duplicated genre only once per game", () => {
  assert.equal(
    getSharedGameGenre([
      { game: { genres: ["Puzzle", "puzzle"] } },
      { game: { genres: ["Puzzle"] } },
    ])?.count,
    2,
  );
});

test("prefers a genre shared across all three picks", () => {
  assert.deepEqual(
    getSharedGameGenre([
      { game: { genres: ["Adventure", "Puzzle"] } },
      { game: { genres: ["Puzzle", "RPG"] } },
      { game: { genres: ["Puzzle", "Strategy"] } },
    ]),
    { count: 3, name: "Puzzle" },
  );
});
