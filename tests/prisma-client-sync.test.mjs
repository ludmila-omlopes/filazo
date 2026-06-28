import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import {
  EntrySource,
  ExternalProvider,
  Prisma,
  UserGameStatus,
} from "@prisma/client";

test("generated Prisma client includes synced Steam user game fields", () => {
  const model = Prisma.dmmf.datamodel.models.find(
    (item) => item.name === "UserGameEntry",
  );
  const gameModel = Prisma.dmmf.datamodel.models.find(
    (item) => item.name === "Game",
  );
  const insightModel = Prisma.dmmf.datamodel.models.find(
    (item) => item.name === "UserGameInsight",
  );
  const AssistantRunModel = Prisma.dmmf.datamodel.models.find(
    (item) => item.name === "AssistantRun",
  );
  const userModel = Prisma.dmmf.datamodel.models.find(
    (item) => item.name === "User",
  );
  const reviewModel = Prisma.dmmf.datamodel.models.find(
    (item) => item.name === "UserGameReview",
  );
  const journalModel = Prisma.dmmf.datamodel.models.find(
    (item) => item.name === "GameJournalEntry",
  );
  const journalMediaModel = Prisma.dmmf.datamodel.models.find(
    (item) => item.name === "JournalMedia",
  );

  assert.ok(model, "UserGameEntry model should exist in generated Prisma client");
  assert.ok(
    model.fields.some((field) => field.name === "completionPercent"),
    "Run npm run db:generate after changing prisma/schema.prisma.",
  );
  assert.ok(
    model.fields.some((field) => field.name === "lastPlayedAt"),
    "Run npm run db:generate after changing prisma/schema.prisma.",
  );
  assert.ok(
    model.fields.some((field) => field.name === "activeBacklog"),
    "Run npm run db:generate after changing prisma/schema.prisma.",
  );
  assert.ok(
    model.fields.some((field) => field.name === "currentPlayingSlot"),
    "Run npm run db:generate after changing prisma/schema.prisma.",
  );
  assert.ok(
    model.fields.some((field) => field.name === "playingNextSlot"),
    "Run npm run db:generate after changing prisma/schema.prisma.",
  );
  assert.ok(gameModel, "Game model should exist in generated Prisma client");
  assert.ok(
    gameModel.fields.some((field) => field.name === "hltbMainStoryMinutes"),
    "Run npm run db:generate after changing prisma/schema.prisma.",
  );
  assert.ok(
    gameModel.fields.some((field) => field.name === "hltbCompletionistMinutes"),
    "Run npm run db:generate after changing prisma/schema.prisma.",
  );
  assert.ok(
    gameModel.fields.some((field) => field.name === "metacriticScore"),
    "Run npm run db:generate after changing prisma/schema.prisma.",
  );
  assert.ok(
    gameModel.fields.some((field) => field.name === "metacriticUrl"),
    "Run npm run db:generate after changing prisma/schema.prisma.",
  );
  assert.ok(insightModel, "UserGameInsight model should exist.");
  assert.ok(AssistantRunModel, "AssistantRun model should exist.");
  assert.ok(userModel, "User model should exist.");
  assert.ok(reviewModel, "UserGameReview model should exist.");
  assert.ok(journalModel, "GameJournalEntry model should exist.");
  assert.ok(journalMediaModel, "JournalMedia model should exist.");
  assert.ok(
    userModel.fields.some((field) => field.name === "onboardingAnswers"),
    "Run npm run db:generate after changing prisma/schema.prisma.",
  );
  assert.equal(
    ExternalProvider.PLAYSTATION,
    "PLAYSTATION",
    "Run npm run db:generate after adding PlayStation to prisma/schema.prisma.",
  );
  assert.equal(
    ExternalProvider.XBOX,
    "XBOX",
    "Run npm run db:generate after adding Xbox to prisma/schema.prisma.",
  );
  assert.equal(
    EntrySource.PLAYSTATION,
    "PLAYSTATION",
    "Run npm run db:generate after adding PlayStation sync to prisma/schema.prisma.",
  );
  assert.equal(
    EntrySource.XBOX,
    "XBOX",
    "Run npm run db:generate after adding Xbox sync to prisma/schema.prisma.",
  );
  assert.equal(
    EntrySource.PHOTO,
    "PHOTO",
    "Run npm run db:generate after adding photo imports to prisma/schema.prisma.",
  );
  assert.equal(
    UserGameStatus.DROPPED,
    "DROPPED",
    "Run npm run db:generate after adding dropped status to prisma/schema.prisma.",
  );
  assert.equal(
    UserGameStatus.PLAYING_NEXT,
    "PLAYING_NEXT",
    "Run npm run db:generate after adding playing-next status to prisma/schema.prisma.",
  );
});

test("database initializer rejects SQLite URLs", () => {
  const result = spawnSync("node", ["scripts/init-db.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: "file:./dev.db",
    },
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /PostgreSQL database/);
});
