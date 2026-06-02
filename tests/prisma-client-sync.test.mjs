import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { Prisma } from "@prisma/client";

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
  assert.ok(gameModel, "Game model should exist in generated Prisma client");
  assert.ok(
    gameModel.fields.some((field) => field.name === "hltbMainStoryMinutes"),
    "Run npm run db:generate after changing prisma/schema.prisma.",
  );
  assert.ok(
    gameModel.fields.some((field) => field.name === "hltbCompletionistMinutes"),
    "Run npm run db:generate after changing prisma/schema.prisma.",
  );
  assert.ok(insightModel, "UserGameInsight model should exist.");
  assert.ok(AssistantRunModel, "AssistantRun model should exist.");
});

test("SQLite bootstrap creates synced Steam user game columns", () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), "checkpoint-db-"));
  const databasePath = path.join(tempDir, "checkpoint-test.db");

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
      assertTableHasColumn(db, "ImportRow", "completionPercent");
      assertTableHasColumn(db, "UserGameInsight", "signalType");
      assertTableHasColumn(db, "UserGameInsight", "friction");
      assertTableHasColumn(db, "AssistantRun", "outputSummary");
      assertTableHasColumn(db, "Game", "hltbMainStoryMinutes");
      assertTableHasColumn(db, "Game", "hltbMainExtraMinutes");
      assertTableHasColumn(db, "Game", "hltbCompletionistMinutes");
      assertTableHasColumn(db, "Game", "hltbUpdatedAt");
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
