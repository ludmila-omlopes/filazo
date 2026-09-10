import assert from "node:assert/strict";
import { test } from "node:test";
import { GameCompletionModel } from "@prisma/client";
import {
  getEffectiveGameCompletionModel,
  inferGameCompletionModel,
} from "./game-completion-model.ts";

test("classifies a single-player game with a story estimate as campaign", () => {
  assert.equal(
    inferGameCompletionModel({ gameModes: ["Single player"], hltbMainStoryMinutes: 900 }).model,
    GameCompletionModel.CAMPAIGN,
  );
});

test("classifies multiplayer-only and MMO games as ongoing", () => {
  assert.equal(
    inferGameCompletionModel({ gameModes: ["Multiplayer"] }).model,
    GameCompletionModel.ONGOING,
  );
  assert.equal(
    inferGameCompletionModel({ gameModes: ["Massively Multiplayer Online"] }).model,
    GameCompletionModel.ONGOING,
  );
});

test("keeps games with campaign and service evidence as hybrid", () => {
  assert.equal(
    inferGameCompletionModel({ gameModes: ["Single player", "Multiplayer"], genres: ["Sports"], hltbMainStoryMinutes: 600 }).model,
    GameCompletionModel.HYBRID,
  );
});

test("manual model wins over automatic evidence, including manual unknown", () => {
  assert.equal(
    getEffectiveGameCompletionModel({ completionModel: GameCompletionModel.CAMPAIGN, completionModelSource: "MANUAL", gameModes: ["Multiplayer"] }),
    GameCompletionModel.CAMPAIGN,
  );
  assert.equal(
    getEffectiveGameCompletionModel({ completionModel: "UNKNOWN", completionModelSource: "MANUAL", hltbMainStoryMinutes: 600 }),
    GameCompletionModel.UNKNOWN,
  );
});

test("cooperative campaigns retain their main-story evidence", () => {
  for (const mode of ["Co-operative", "Multiplayer", "Split screen"]) {
    assert.equal(
      inferGameCompletionModel({ gameModes: [mode], hltbMainStoryMinutes: 600 }).model,
      GameCompletionModel.CAMPAIGN,
    );
  }
});

test("solo play alone is not evidence of a finite campaign", () => {
  assert.equal(inferGameCompletionModel({ gameModes: ["Single player"], genres: ["Pinball"] }).model, GameCompletionModel.ONGOING);
  assert.equal(inferGameCompletionModel({ gameModes: ["Single player"] }).model, GameCompletionModel.UNKNOWN);
  assert.equal(inferGameCompletionModel({ gameModes: ["Co-operative"] }).model, GameCompletionModel.UNKNOWN);
});

test("automatic models are recalculated when a story marker is discovered", () => {
  const game = { completionModel: "ONGOING", completionModelSource: "RULES", gameModes: ["Multiplayer"] };
  assert.equal(getEffectiveGameCompletionModel(game), GameCompletionModel.ONGOING);
  assert.equal(getEffectiveGameCompletionModel({ ...game, providerLinks: [{ storyAchievementId: "credits" }] }), GameCompletionModel.CAMPAIGN);
  assert.equal(getEffectiveGameCompletionModel({ ...game, gameModes: ["Massively Multiplayer Online"], providerLinks: [{ hasStoryAchievement: true }] }), GameCompletionModel.HYBRID);
});

test("old automatic solo classifications are not retained without story evidence", () => {
  assert.equal(getEffectiveGameCompletionModel({ completionModel: "CAMPAIGN", completionModelSource: "RULES", gameModes: ["Single player"] }), GameCompletionModel.UNKNOWN);
});
