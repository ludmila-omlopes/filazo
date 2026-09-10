import assert from "node:assert/strict";
import { test } from "node:test";
import { refreshGameCompletionModel } from "../src/lib/game-completion-refresh.ts";

test("refresh persists story evidence and subsequent metadata refreshes retain it", async () => {
  const game = {
    id: "coop-game",
    gameModes: ["Co-operative"],
    completionModel: "ONGOING",
    completionModelSource: "RULES",
    hltbMainStoryMinutes: null,
  };
  const links = [{ storyAchievementId: "credits" }];
  const client = {
    game: {
      async findUniqueOrThrow(query) {
        assert.equal(query.where.id, game.id);
        assert.equal(query.include.providerLinks.select.storyAchievementId, true);
        return { ...game, providerLinks: links };
      },
      async update({ data }) {
        Object.assign(game, data);
        return { ...game };
      },
    },
  };
  assert.equal((await refreshGameCompletionModel(client, game.id)).completionModel, "CAMPAIGN");
  game.gameModes = ["Multiplayer"];
  assert.equal((await refreshGameCompletionModel(client, game.id)).completionModel, "CAMPAIGN");
  game.gameModes = ["Massively Multiplayer Online"];
  assert.equal((await refreshGameCompletionModel(client, game.id)).completionModel, "HYBRID");
});

test("refresh preserves a manual classification and all its provenance", async () => {
  const game = {
    id: "manual-game",
    completionModel: "ONGOING",
    completionModelSource: "MANUAL",
    completionModelConfidence: 100,
    completionModelCheckedAt: new Date("2026-01-01"),
    hltbMainStoryMinutes: 600,
  };
  const client = {
    game: {
      async findUniqueOrThrow() {
        return { ...game, providerLinks: [{ storyAchievementId: "credits" }] };
      },
      async update() {
        assert.fail("Manual classifications must not be overwritten");
      },
    },
  };
  assert.deepEqual(await refreshGameCompletionModel(client, game.id), game);
});
