-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ExternalProvider" AS ENUM ('STEAM', 'PLAYSTATION', 'XBOX', 'IGDB', 'HLTB', 'METACRITIC');

-- CreateEnum
CREATE TYPE "UserGameStatus" AS ENUM ('OWNED', 'WISHLIST', 'PLAYING', 'PLAYING_NEXT', 'BACKLOG', 'COMPLETED', 'DROPPED');

-- CreateEnum
CREATE TYPE "EntrySource" AS ENUM ('STEAM', 'PLAYSTATION', 'XBOX', 'CSV', 'MANUAL', 'PHOTO');

-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ImportRowStatus" AS ENUM ('IMPORTED', 'SKIPPED', 'FAILED');

-- CreateEnum
CREATE TYPE "BacklogFriction" AS ENUM ('CHOICE_OVERLOAD', 'TIME_COMMITMENT', 'GENRE_FATIGUE', 'LOW_CONFIDENCE_MATCH', 'TOO_MANY_SIMILAR_GAMES', 'STALE_SESSION', 'COMPLETION_PRESSURE', 'TECHNICAL_OR_PLATFORM_FRICTION', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "AssistantSignalType" AS ENUM ('UNTOUCHED', 'SAMPLED_DROPPED', 'STALE_PLAYING', 'FINISHABLE_SOON', 'LIKELY_FINISHED', 'WISHLIST_RISK', 'BUY_RISK', 'RETURN_CANDIDATE', 'RELEASE_CANDIDATE', 'FINISH_BEFORE_RELEASE', 'RISKY_TO_START_BEFORE_RELEASE', 'UPCOMING_RELEASE_WATCH');

-- CreateEnum
CREATE TYPE "BetaTesterStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "displayName" TEXT,
    "email" TEXT,
    "passwordHash" TEXT,
    "googleSubject" TEXT,
    "youtubeSubject" TEXT,
    "avatarUrl" TEXT,
    "onboardingAnswers" JSONB,
    "onboardingCompletedAt" TIMESTAMP(3),
    "onboardingSkippedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "ExternalProvider" NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "username" TEXT,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "profileUrl" TEXT,
    "metadata" JSONB,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "summary" TEXT,
    "coverUrl" TEXT,
    "heroUrl" TEXT,
    "releaseDate" TIMESTAMP(3),
    "aggregatedRating" DOUBLE PRECISION,
    "totalRatingCount" INTEGER,
    "genres" JSONB,
    "platforms" JSONB,
    "screenshots" JSONB,
    "websites" JSONB,
    "metadataSource" "ExternalProvider",
    "igdbId" INTEGER,
    "igdbSlug" TEXT,
    "hltbMainStoryMinutes" INTEGER,
    "hltbMainExtraMinutes" INTEGER,
    "hltbCompletionistMinutes" INTEGER,
    "hltbUpdatedAt" TIMESTAMP(3),
    "metacriticScore" INTEGER,
    "metacriticUrl" TEXT,
    "metacriticUpdatedAt" TIMESTAMP(3),
    "upcomingReleases" JSONB,
    "upcomingReleasesCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameProviderLink" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "provider" "ExternalProvider" NOT NULL,
    "providerGameId" TEXT NOT NULL,
    "storeUrl" TEXT,
    "rawData" JSONB,
    "storyAchievementId" TEXT,
    "storyAchievementName" TEXT,
    "storyAchievementSource" TEXT,
    "storyAchievementCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameProviderLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserGameEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "status" "UserGameStatus" NOT NULL,
    "source" "EntrySource" NOT NULL,
    "provider" "ExternalProvider",
    "externalAccountId" TEXT,
    "platformName" TEXT,
    "playtimeMinutes" INTEGER,
    "lastPlayedAt" TIMESTAMP(3),
    "completionPercent" INTEGER,
    "finishedAt" TIMESTAMP(3),
    "finishedSource" TEXT,
    "notes" TEXT,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3),
    "abandonedAt" TIMESTAMP(3),
    "abandonReason" TEXT,
    "activeBacklog" BOOLEAN NOT NULL DEFAULT true,
    "userIntent" TEXT,
    "desiredSessionMin" INTEGER,
    "currentPlayingSlot" INTEGER,
    "playingNextSlot" INTEGER,
    "lastSyncedAt" TIMESTAMP(3),
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserGameEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserGameReview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userGameEntryId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "provider" "ExternalProvider",
    "externalReviewId" TEXT,
    "title" TEXT,
    "body" TEXT,
    "ratingText" TEXT,
    "score" INTEGER,
    "recommended" BOOLEAN,
    "language" TEXT,
    "sourceUrl" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "updatedOnProviderAt" TIMESTAMP(3),
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserGameReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameJournalEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userGameEntryId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "title" TEXT,
    "body" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "externalSourceId" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mechanicsRecap" TEXT,
    "achievementSummary" TEXT,
    "latestAchievementName" TEXT,
    "latestAchievementUnlockedAt" TIMESTAMP(3),
    "inferenceConfidence" INTEGER,
    "audioTranscript" TEXT,
    "translatedTranscript" TEXT,
    "transcriptLanguage" TEXT,
    "transcriptConfidence" DOUBLE PRECISION,
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameJournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalMedia" (
    "id" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileName" TEXT,
    "sizeBytes" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'manual-upload',
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserGameInsight" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userGameEntryId" TEXT NOT NULL,
    "signalType" "AssistantSignalType" NOT NULL,
    "friction" "BacklogFriction" NOT NULL,
    "score" INTEGER NOT NULL,
    "confidence" INTEGER NOT NULL,
    "reasons" JSONB NOT NULL,
    "suggestedAction" TEXT,
    "generatedBy" TEXT NOT NULL DEFAULT 'rules',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserGameInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "inputSummary" JSONB NOT NULL,
    "outputSummary" JSONB NOT NULL,
    "model" TEXT,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiSettings" (
    "id" TEXT NOT NULL,
    "assistantChatEnabled" BOOLEAN NOT NULL DEFAULT true,
    "assistantPlayNextEnabled" BOOLEAN NOT NULL DEFAULT true,
    "assistantSummaryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "playerProfileEnabled" BOOLEAN NOT NULL DEFAULT true,
    "photoImportEnabled" BOOLEAN NOT NULL DEFAULT true,
    "voiceTranscriptionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "voiceTranslationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "storyCompletionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "userDailySpendLimitUsd" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "chatDailyTokenLimit" INTEGER NOT NULL DEFAULT 20000,
    "assistantPlayNextDailyTokenLimit" INTEGER NOT NULL DEFAULT 12000,
    "playerProfileWeeklyCallLimit" INTEGER NOT NULL DEFAULT 2,
    "photoImportDailyCallLimit" INTEGER NOT NULL DEFAULT 5,
    "photoImportDailyFileLimit" INTEGER NOT NULL DEFAULT 10,
    "voiceTranscriptionDailyCallLimit" INTEGER NOT NULL DEFAULT 10,
    "userDailyLimit" INTEGER NOT NULL DEFAULT 20,
    "globalDailyLimit" INTEGER NOT NULL DEFAULT 100,
    "chatBudgetUnits" INTEGER NOT NULL DEFAULT 3,
    "chatMaxSteps" INTEGER NOT NULL DEFAULT 3,
    "chatMaxOutputTokens" INTEGER NOT NULL DEFAULT 700,
    "assistantPlayNextMaxOutputTokens" INTEGER NOT NULL DEFAULT 900,
    "assistantSummaryMaxOutputTokens" INTEGER NOT NULL DEFAULT 650,
    "playerProfileMaxCalls" INTEGER NOT NULL DEFAULT 3,
    "playerProfileMaxOutputTokens" INTEGER NOT NULL DEFAULT 1400,
    "photoImportMaxFiles" INTEGER NOT NULL DEFAULT 2,
    "photoImportMaxFileBytes" INTEGER NOT NULL DEFAULT 4194304,
    "photoImportMaxOutputTokens" INTEGER NOT NULL DEFAULT 1000,
    "photoImportMaxCandidates" INTEGER NOT NULL DEFAULT 30,
    "voiceMaxFileBytes" INTEGER NOT NULL DEFAULT 10485760,
    "voiceRecordingMaxSeconds" INTEGER NOT NULL DEFAULT 180,
    "voiceTranslationMaxOutputTokens" INTEGER NOT NULL DEFAULT 900,
    "storyCompletionMaxClassificationsPerRun" INTEGER NOT NULL DEFAULT 10,
    "storyCompletionMaxOutputTokens" INTEGER NOT NULL DEFAULT 220,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "profile" JSONB NOT NULL,
    "toolTrace" JSONB,
    "model" TEXT,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BetaTesterApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT,
    "platforms" JSONB,
    "retroGames" TEXT,
    "status" "BetaTesterStatus" NOT NULL DEFAULT 'DRAFT',
    "justification" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "accessExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BetaTesterApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'PENDING',
    "columnMapping" JSONB,
    "summary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRow" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "rawData" JSONB NOT NULL,
    "normalizedTitle" TEXT,
    "platformName" TEXT,
    "statusText" TEXT,
    "playtimeMinutes" INTEGER,
    "completionPercent" INTEGER,
    "notes" TEXT,
    "externalId" TEXT,
    "outcome" "ImportRowStatus",
    "error" TEXT,
    "matchedGameId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleSubject_key" ON "User"("googleSubject");

-- CreateIndex
CREATE UNIQUE INDEX "User_youtubeSubject_key" ON "User"("youtubeSubject");

-- CreateIndex
CREATE INDEX "ExternalAccount_userId_provider_idx" ON "ExternalAccount"("userId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalAccount_provider_providerAccountId_key" ON "ExternalAccount"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Game_slug_key" ON "Game"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Game_igdbId_key" ON "Game"("igdbId");

-- CreateIndex
CREATE INDEX "Game_normalizedName_idx" ON "Game"("normalizedName");

-- CreateIndex
CREATE INDEX "GameProviderLink_gameId_idx" ON "GameProviderLink"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "GameProviderLink_provider_providerGameId_key" ON "GameProviderLink"("provider", "providerGameId");

-- CreateIndex
CREATE INDEX "UserGameEntry_userId_status_idx" ON "UserGameEntry"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "UserGameEntry_userId_gameId_status_key" ON "UserGameEntry"("userId", "gameId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "UserGameEntry_userId_currentPlayingSlot_key" ON "UserGameEntry"("userId", "currentPlayingSlot");

-- CreateIndex
CREATE UNIQUE INDEX "UserGameEntry_userId_playingNextSlot_key" ON "UserGameEntry"("userId", "playingNextSlot");

-- CreateIndex
CREATE INDEX "UserGameReview_userId_createdAt_idx" ON "UserGameReview"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserGameReview_userGameEntryId_idx" ON "UserGameReview"("userGameEntryId");

-- CreateIndex
CREATE INDEX "UserGameReview_gameId_reviewedAt_idx" ON "UserGameReview"("gameId", "reviewedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserGameReview_provider_externalReviewId_key" ON "UserGameReview"("provider", "externalReviewId");

-- CreateIndex
CREATE INDEX "GameJournalEntry_userId_occurredAt_idx" ON "GameJournalEntry"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "GameJournalEntry_gameId_occurredAt_idx" ON "GameJournalEntry"("gameId", "occurredAt");

-- CreateIndex
CREATE INDEX "GameJournalEntry_userGameEntryId_occurredAt_idx" ON "GameJournalEntry"("userGameEntryId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "GameJournalEntry_userGameEntryId_source_externalSourceId_key" ON "GameJournalEntry"("userGameEntryId", "source", "externalSourceId");

-- CreateIndex
CREATE INDEX "JournalMedia_journalEntryId_idx" ON "JournalMedia"("journalEntryId");

-- CreateIndex
CREATE INDEX "JournalMedia_kind_idx" ON "JournalMedia"("kind");

-- CreateIndex
CREATE INDEX "UserGameInsight_userId_signalType_idx" ON "UserGameInsight"("userId", "signalType");

-- CreateIndex
CREATE INDEX "UserGameInsight_userId_score_idx" ON "UserGameInsight"("userId", "score");

-- CreateIndex
CREATE UNIQUE INDEX "UserGameInsight_userGameEntryId_signalType_key" ON "UserGameInsight"("userGameEntryId", "signalType");

-- CreateIndex
CREATE INDEX "AssistantRun_userId_createdAt_idx" ON "AssistantRun"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerProfile_userId_key" ON "PlayerProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BetaTesterApplication_userId_key" ON "BetaTesterApplication"("userId");

-- CreateIndex
CREATE INDEX "BetaTesterApplication_status_createdAt_idx" ON "BetaTesterApplication"("status", "createdAt");

-- CreateIndex
CREATE INDEX "BetaTesterApplication_reviewedById_idx" ON "BetaTesterApplication"("reviewedById");

-- CreateIndex
CREATE INDEX "ImportJob_userId_createdAt_idx" ON "ImportJob"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ImportRow_jobId_rowIndex_idx" ON "ImportRow"("jobId", "rowIndex");

-- AddForeignKey
ALTER TABLE "ExternalAccount" ADD CONSTRAINT "ExternalAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameProviderLink" ADD CONSTRAINT "GameProviderLink_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGameEntry" ADD CONSTRAINT "UserGameEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGameEntry" ADD CONSTRAINT "UserGameEntry_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGameEntry" ADD CONSTRAINT "UserGameEntry_externalAccountId_fkey" FOREIGN KEY ("externalAccountId") REFERENCES "ExternalAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGameReview" ADD CONSTRAINT "UserGameReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGameReview" ADD CONSTRAINT "UserGameReview_userGameEntryId_fkey" FOREIGN KEY ("userGameEntryId") REFERENCES "UserGameEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGameReview" ADD CONSTRAINT "UserGameReview_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameJournalEntry" ADD CONSTRAINT "GameJournalEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameJournalEntry" ADD CONSTRAINT "GameJournalEntry_userGameEntryId_fkey" FOREIGN KEY ("userGameEntryId") REFERENCES "UserGameEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameJournalEntry" ADD CONSTRAINT "GameJournalEntry_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalMedia" ADD CONSTRAINT "JournalMedia_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "GameJournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGameInsight" ADD CONSTRAINT "UserGameInsight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGameInsight" ADD CONSTRAINT "UserGameInsight_userGameEntryId_fkey" FOREIGN KEY ("userGameEntryId") REFERENCES "UserGameEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantRun" ADD CONSTRAINT "AssistantRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerProfile" ADD CONSTRAINT "PlayerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BetaTesterApplication" ADD CONSTRAINT "BetaTesterApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BetaTesterApplication" ADD CONSTRAINT "BetaTesterApplication_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRow" ADD CONSTRAINT "ImportRow_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRow" ADD CONSTRAINT "ImportRow_matchedGameId_fkey" FOREIGN KEY ("matchedGameId") REFERENCES "Game"("id") ON DELETE SET NULL ON UPDATE CASCADE;

