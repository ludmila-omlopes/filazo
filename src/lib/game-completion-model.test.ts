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
    inferGameCompletionModel({ gameModes: ["Single player", "Multiplayer"], genres: ["Sports"] }).model,
    GameCompletionModel.HYBRID,
  );
});

test("stored model wins over inferred unknown data", () => {
  assert.equal(
    getEffectiveGameCompletionModel({ completionModel: GameCompletionModel.CAMPAIGN, gameModes: ["Multiplayer"] }),
    GameCompletionModel.CAMPAIGN,
  );
});
