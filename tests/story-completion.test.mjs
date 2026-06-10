import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyStoryAchievementHeuristically } from "../src/lib/story-achievement-classifier.ts";

test("finds the story-completion achievement among collectibles", () => {
  const pick = classifyStoryAchievementHeuristically([
    { id: "ACH_FISH", name: "Angler", description: "Catch 50 fish." },
    {
      id: "ACH_STORY",
      name: "Journey's End",
      description: "Complete the main story.",
    },
    {
      id: "ACH_ALL",
      name: "Completionist",
      description: "Unlock every other achievement.",
    },
  ]);

  assert.equal(pick?.id, "ACH_STORY");
});

test("prefers difficulty-agnostic completion over hard-mode variants", () => {
  const pick = classifyStoryAchievementHeuristically([
    {
      id: "ACH_HARD",
      name: "Unbreakable",
      description: "Beat the game on hard difficulty.",
    },
    {
      id: "ACH_ANY",
      name: "Roll Credits",
      description: "Beat the game on any difficulty.",
    },
  ]);

  assert.equal(pick?.id, "ACH_ANY");
});

test("matches credits-roll wording", () => {
  const pick = classifyStoryAchievementHeuristically([
    { id: "A", name: "First Steps", description: "Open the first door." },
    { id: "B", name: "The Show's Over", description: "See the credits." },
  ]);

  assert.equal(pick?.id, "B");
});

test("returns null when nothing resembles story completion", () => {
  const pick = classifyStoryAchievementHeuristically([
    { id: "A", name: "Sharpshooter", description: "Land 100 headshots." },
    { id: "B", name: "Wealthy", description: "Hold 10,000 gold." },
  ]);

  assert.equal(pick, null);
});
