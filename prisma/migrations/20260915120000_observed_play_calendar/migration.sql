CREATE TABLE "UserCalendarState" (
  "userId" TEXT NOT NULL PRIMARY KEY,
  "automaticAt" TIMESTAMP(3), "manualAt" TIMESTAMP(3), "retryAfter" TIMESTAMP(3), "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "PlayObservation" (
  "entryId" TEXT NOT NULL, "day" DATE NOT NULL, "observedAt" TIMESTAMP(3) NOT NULL,
  "totalMinutes" INTEGER NOT NULL, "source" TEXT NOT NULL,
  CONSTRAINT "PlayObservation_pkey" PRIMARY KEY ("entryId", "day")
);
CREATE TABLE "CalendarEstimate" (
  "entryId" TEXT NOT NULL PRIMARY KEY, "calculatedAt" TIMESTAMP(3) NOT NULL,
  "estimatedFinish" DATE, "weeklyMinutes" DOUBLE PRECISION, "reason" TEXT NOT NULL
);
CREATE TABLE "CalendarSession" (
  "entryId" TEXT NOT NULL, "day" DATE NOT NULL, "minutes" INTEGER NOT NULL,
  CONSTRAINT "CalendarSession_pkey" PRIMARY KEY ("entryId", "day")
);
CREATE TABLE "ReleaseAnnouncement" (
  "id" TEXT NOT NULL PRIMARY KEY, "gameId" TEXT NOT NULL, "platform" TEXT NOT NULL,
  "region" TEXT NOT NULL, "releaseDate" DATE, "dateLabel" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL, "checkedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "UserCalendarRelease" (
  "userId" TEXT NOT NULL, "releaseId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserCalendarRelease_pkey" PRIMARY KEY ("userId", "releaseId")
);
CREATE TABLE "CalendarReleaseRun" (
  "day" DATE NOT NULL, "scope" TEXT NOT NULL, "status" TEXT NOT NULL, "model" TEXT, "usage" JSONB,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "finishedAt" TIMESTAMP(3),
  CONSTRAINT "CalendarReleaseRun_pkey" PRIMARY KEY ("day", "scope")
);
CREATE INDEX "UserCalendarState_automaticAt_idx" ON "UserCalendarState"("automaticAt");
CREATE UNIQUE INDEX "ReleaseAnnouncement_gameId_platform_region_key" ON "ReleaseAnnouncement"("gameId", "platform", "region");
CREATE INDEX "ReleaseAnnouncement_checkedAt_idx" ON "ReleaseAnnouncement"("checkedAt");
CREATE INDEX "ReleaseAnnouncement_releaseDate_idx" ON "ReleaseAnnouncement"("releaseDate");
ALTER TABLE "UserCalendarState" ADD CONSTRAINT "UserCalendarState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayObservation" ADD CONSTRAINT "PlayObservation_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "UserGameEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarEstimate" ADD CONSTRAINT "CalendarEstimate_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "UserGameEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarSession" ADD CONSTRAINT "CalendarSession_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "UserGameEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReleaseAnnouncement" ADD CONSTRAINT "ReleaseAnnouncement_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserCalendarRelease" ADD CONSTRAINT "UserCalendarRelease_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserCalendarRelease" ADD CONSTRAINT "UserCalendarRelease_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "ReleaseAnnouncement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
