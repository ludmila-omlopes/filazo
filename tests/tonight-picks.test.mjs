import assert from "node:assert/strict";
import { test } from "node:test";
import { selectTonightBasePicks } from "../src/lib/tonight-picks.ts";

test("stored recommendations stay first and the deck fills from fallbacks", () => {
  assert.deepEqual(
    selectTonightBasePicks({
      storedRecommendations: [createPick("stored")],
      generatedPicks: [createPick("generated")],
      shelfPicks: [createPick("shelf")],
    }).map((pick) => pick.entryId),
    ["stored", "generated", "shelf"],
  );
});

test("generated picks win over shelf picks when stored is empty", () => {
  assert.deepEqual(
    selectTonightBasePicks({
      storedRecommendations: [],
      generatedPicks: [createPick("generated")],
      shelfPicks: [createPick("shelf")],
    }).map((pick) => pick.entryId),
    ["generated", "shelf"],
  );
});

test("shelf picks are used when stored and generated are empty", () => {
  assert.deepEqual(
    selectTonightBasePicks({
      storedRecommendations: [],
      generatedPicks: [],
      shelfPicks: [createPick("shelf")],
    }).map((pick) => pick.entryId),
    ["shelf"],
  );
});

test("empty sources return an empty deck", () => {
  assert.deepEqual(
    selectTonightBasePicks({
      storedRecommendations: [],
      generatedPicks: [],
      shelfPicks: [],
    }),
    [],
  );
});

test("duplicate entries are only included once", () => {
  assert.deepEqual(
    selectTonightBasePicks({
      storedRecommendations: [createPick("same"), createPick("stored")],
      generatedPicks: [createPick("same"), createPick("generated")],
      shelfPicks: [createPick("generated"), createPick("shelf")],
    }).map((pick) => pick.entryId),
    ["same", "stored", "generated", "shelf"],
  );
});

test("deck size is capped", () => {
  assert.deepEqual(
    selectTonightBasePicks(
      {
        storedRecommendations: [createPick("one"), createPick("two")],
        generatedPicks: [createPick("three"), createPick("four")],
        shelfPicks: [createPick("five")],
      },
      3,
    ).map((pick) => pick.entryId),
    ["one", "two", "three"],
  );
});

test("deck is uncapped by default", () => {
  assert.deepEqual(
    selectTonightBasePicks({
      storedRecommendations: [createPick("one"), createPick("two")],
      generatedPicks: [createPick("three"), createPick("four")],
      shelfPicks: [createPick("five")],
    }).map((pick) => pick.entryId),
    ["one", "two", "three", "four", "five"],
  );
});

function createPick(entryId) {
  return { entryId };
}
