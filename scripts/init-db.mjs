import { DatabaseSync } from "node:sqlite";
import path from "node:path";

const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";
const relativePath = databaseUrl.replace(/^file:/, "");
const databasePath = path.isAbsolute(relativePath)
  ? relativePath
  : path.resolve(process.cwd(), "prisma", relativePath.replace(/^\.\//, ""));
const db = new DatabaseSync(databasePath);

db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS "ExternalAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "username" TEXT,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "profileUrl" TEXT,
    "metadata" TEXT,
    "lastSyncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
  );

  CREATE TABLE IF NOT EXISTS "Game" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "summary" TEXT,
    "coverUrl" TEXT,
    "heroUrl" TEXT,
    "releaseDate" DATETIME,
    "aggregatedRating" REAL,
    "totalRatingCount" INTEGER,
    "genres" TEXT,
    "platforms" TEXT,
    "screenshots" TEXT,
    "websites" TEXT,
    "metadataSource" TEXT,
    "igdbId" INTEGER,
    "igdbSlug" TEXT,
    "hltbMainStoryMinutes" INTEGER,
    "hltbMainExtraMinutes" INTEGER,
    "hltbCompletionistMinutes" INTEGER,
    "hltbUpdatedAt" DATETIME,
    "metacriticScore" INTEGER,
    "metacriticUrl" TEXT,
    "metacriticUpdatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS "GameProviderLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerGameId" TEXT NOT NULL,
    "storeUrl" TEXT,
    "rawData" TEXT,
    "storyAchievementId" TEXT,
    "storyAchievementName" TEXT,
    "storyAchievementSource" TEXT,
    "storyAchievementCheckedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE
  );

  CREATE TABLE IF NOT EXISTS "UserGameEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "provider" TEXT,
    "externalAccountId" TEXT,
    "platformName" TEXT,
    "playtimeMinutes" INTEGER,
    "lastPlayedAt" DATETIME,
    "completionPercent" INTEGER,
    "finishedAt" DATETIME,
    "finishedSource" TEXT,
    "notes" TEXT,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" DATETIME,
    "abandonedAt" DATETIME,
    "abandonReason" TEXT,
    "activeBacklog" BOOLEAN NOT NULL DEFAULT true,
    "userIntent" TEXT,
    "desiredSessionMin" INTEGER,
    "lastSyncedAt" DATETIME,
    "rawData" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("externalAccountId") REFERENCES "ExternalAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE
  );

  CREATE TABLE IF NOT EXISTS "ImportJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "columnMapping" TEXT,
    "summary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
  );

  CREATE TABLE IF NOT EXISTS "ImportRow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "rawData" TEXT NOT NULL,
    "normalizedTitle" TEXT,
    "platformName" TEXT,
    "statusText" TEXT,
    "playtimeMinutes" INTEGER,
    "completionPercent" INTEGER,
    "notes" TEXT,
    "externalId" TEXT,
    "outcome" TEXT,
    "error" TEXT,
    "matchedGameId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("jobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("matchedGameId") REFERENCES "Game"("id") ON DELETE SET NULL ON UPDATE CASCADE
  );

  CREATE TABLE IF NOT EXISTS "UserGameInsight" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "userGameEntryId" TEXT NOT NULL,
    "signalType" TEXT NOT NULL,
    "friction" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "confidence" INTEGER NOT NULL,
    "reasons" TEXT NOT NULL,
    "suggestedAction" TEXT,
    "generatedBy" TEXT NOT NULL DEFAULT 'rules',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("userGameEntryId") REFERENCES "UserGameEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE
  );

  CREATE TABLE IF NOT EXISTS "PlayerProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "profile" TEXT NOT NULL,
    "toolTrace" TEXT,
    "model" TEXT,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
  );

  CREATE TABLE IF NOT EXISTS "AssistantRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "inputSummary" TEXT NOT NULL,
    "outputSummary" TEXT NOT NULL,
    "model" TEXT,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
  );

  CREATE UNIQUE INDEX IF NOT EXISTS "Game_slug_key" ON "Game"("slug");
  CREATE UNIQUE INDEX IF NOT EXISTS "Game_igdbId_key" ON "Game"("igdbId");
  CREATE UNIQUE INDEX IF NOT EXISTS "ExternalAccount_provider_providerAccountId_key" ON "ExternalAccount"("provider", "providerAccountId");
  CREATE UNIQUE INDEX IF NOT EXISTS "GameProviderLink_provider_providerGameId_key" ON "GameProviderLink"("provider", "providerGameId");
  CREATE UNIQUE INDEX IF NOT EXISTS "UserGameEntry_userId_gameId_status_key" ON "UserGameEntry"("userId", "gameId", "status");
  CREATE INDEX IF NOT EXISTS "ExternalAccount_userId_provider_idx" ON "ExternalAccount"("userId", "provider");
  CREATE INDEX IF NOT EXISTS "Game_normalizedName_idx" ON "Game"("normalizedName");
  CREATE INDEX IF NOT EXISTS "GameProviderLink_gameId_idx" ON "GameProviderLink"("gameId");
  CREATE INDEX IF NOT EXISTS "UserGameEntry_userId_status_idx" ON "UserGameEntry"("userId", "status");
  CREATE INDEX IF NOT EXISTS "ImportJob_userId_createdAt_idx" ON "ImportJob"("userId", "createdAt");
  CREATE INDEX IF NOT EXISTS "ImportRow_jobId_rowIndex_idx" ON "ImportRow"("jobId", "rowIndex");
  CREATE UNIQUE INDEX IF NOT EXISTS "UserGameInsight_userGameEntryId_signalType_key" ON "UserGameInsight"("userGameEntryId", "signalType");
  CREATE INDEX IF NOT EXISTS "UserGameInsight_userId_signalType_idx" ON "UserGameInsight"("userId", "signalType");
  CREATE INDEX IF NOT EXISTS "UserGameInsight_userId_score_idx" ON "UserGameInsight"("userId", "score");
  CREATE INDEX IF NOT EXISTS "AssistantRun_userId_createdAt_idx" ON "AssistantRun"("userId", "createdAt");
  CREATE UNIQUE INDEX IF NOT EXISTS "PlayerProfile_userId_key" ON "PlayerProfile"("userId");
`);

function columnExists(tableName, columnName) {
  return db
    .prepare(`PRAGMA table_info("${tableName}")`)
    .all()
    .some((column) => column.name === columnName);
}

function addColumnIfMissing(tableName, columnName, definition) {
  if (!columnExists(tableName, columnName)) {
    db.exec(`ALTER TABLE "${tableName}" ADD COLUMN "${columnName}" ${definition}`);
  }
}

addColumnIfMissing("UserGameEntry", "completionPercent", "INTEGER");
addColumnIfMissing("UserGameEntry", "lastPlayedAt", "DATETIME");
addColumnIfMissing("UserGameEntry", "isFavorite", "BOOLEAN NOT NULL DEFAULT false");
addColumnIfMissing("UserGameEntry", "startedAt", "DATETIME");
addColumnIfMissing("UserGameEntry", "abandonedAt", "DATETIME");
addColumnIfMissing("UserGameEntry", "abandonReason", "TEXT");
addColumnIfMissing("UserGameEntry", "activeBacklog", "BOOLEAN NOT NULL DEFAULT true");
addColumnIfMissing("UserGameEntry", "userIntent", "TEXT");
addColumnIfMissing("UserGameEntry", "desiredSessionMin", "INTEGER");
addColumnIfMissing("UserGameEntry", "finishedAt", "DATETIME");
addColumnIfMissing("UserGameEntry", "finishedSource", "TEXT");
addColumnIfMissing("GameProviderLink", "storyAchievementId", "TEXT");
addColumnIfMissing("GameProviderLink", "storyAchievementName", "TEXT");
addColumnIfMissing("GameProviderLink", "storyAchievementSource", "TEXT");
addColumnIfMissing("GameProviderLink", "storyAchievementCheckedAt", "DATETIME");
addColumnIfMissing("ImportRow", "completionPercent", "INTEGER");
addColumnIfMissing("Game", "hltbMainStoryMinutes", "INTEGER");
addColumnIfMissing("Game", "hltbMainExtraMinutes", "INTEGER");
addColumnIfMissing("Game", "hltbCompletionistMinutes", "INTEGER");
addColumnIfMissing("Game", "hltbUpdatedAt", "DATETIME");
addColumnIfMissing("Game", "metacriticScore", "INTEGER");
addColumnIfMissing("Game", "metacriticUrl", "TEXT");
addColumnIfMissing("Game", "metacriticUpdatedAt", "DATETIME");

console.log(`Initialized SQLite database at ${databasePath}`);
