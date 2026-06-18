import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
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
});

test("SQLite bootstrap creates synced Steam user game columns", () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), "filazo-db-"));
  const databasePath = path.join(tempDir, "filazo-test.db");

  try {
    const result = spawnSync("node", ["scripts/init-db.mjs"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_URL: `file:${databasePath}`,
      },
      encoding: "utf8",
    });

    assert.equal(
      result.status,
      0,
      `init-db failed:\n${result.stdout}\n${result.stderr}`,
    );
    assert.ok(existsSync(databasePath), "init-db should create the database");

    const db = new DatabaseSync(databasePath);
    try {
      assertTableHasColumn(db, "UserGameEntry", "completionPercent");
      assertTableHasColumn(db, "UserGameEntry", "lastPlayedAt");
      assertTableHasColumn(db, "UserGameEntry", "activeBacklog");
      assertTableHasColumn(db, "UserGameEntry", "abandonReason");
      assertTableHasColumn(db, "UserGameEntry", "desiredSessionMin");
      assertTableHasColumn(db, "UserGameEntry", "currentPlayingSlot");
      assertTableHasColumn(db, "User", "onboardingAnswers");
      assertTableHasColumn(db, "User", "onboardingCompletedAt");
      assertTableHasColumn(db, "User", "onboardingSkippedAt");
      assertTableHasColumn(db, "ImportRow", "completionPercent");
      assertTableHasColumn(db, "UserGameInsight", "signalType");
      assertTableHasColumn(db, "UserGameInsight", "friction");
      assertTableHasColumn(db, "UserGameReview", "externalReviewId");
      assertTableHasColumn(db, "UserGameReview", "recommended");
      assertTableHasColumn(db, "GameJournalEntry", "mechanicsRecap");
      assertTableHasColumn(db, "GameJournalEntry", "audioTranscript");
      assertTableHasColumn(db, "JournalMedia", "storageKey");
      assertTableHasColumn(db, "JournalMedia", "mimeType");
      assertTableHasColumn(db, "AssistantRun", "outputSummary");
      assertTableHasColumn(db, "Game", "hltbMainStoryMinutes");
      assertTableHasColumn(db, "Game", "hltbMainExtraMinutes");
      assertTableHasColumn(db, "Game", "hltbCompletionistMinutes");
      assertTableHasColumn(db, "Game", "hltbUpdatedAt");
      assertTableHasColumn(db, "Game", "metacriticScore");
      assertTableHasColumn(db, "Game", "metacriticUrl");
      assertTableHasColumn(db, "Game", "metacriticUpdatedAt");
    } finally {
      db.close();
    }
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
});

function assertTableHasColumn(db, tableName, columnName) {
  const columns = db
    .prepare(`PRAGMA table_info("${tableName}")`)
    .all()
    .map((column) => column.name);

  assert.ok(
    columns.includes(columnName),
    `${tableName} should include ${columnName}`,
  );
}
