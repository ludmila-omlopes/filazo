ALTER TABLE "PlatformSyncRun"
  ADD COLUMN "snapshot" JSONB,
  ADD COLUMN "workerScope" TEXT NOT NULL DEFAULT 'production',
  ADD COLUMN "cursor" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "totalCount" INTEGER,
  ADD COLUMN "workerToken" TEXT,
  ADD COLUMN "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "PlatformSyncRun_provider_status_nextAttemptAt_idx"
  ON "PlatformSyncRun"("provider", "status", "nextAttemptAt");

CREATE TABLE "GameMetadataJob" (
  "gameId" TEXT NOT NULL,
  "workerScope" TEXT NOT NULL DEFAULT 'production',
  "attempt" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseExpiresAt" TIMESTAMP(3),
  "workerToken" TEXT,
  PRIMARY KEY ("gameId", "workerScope"),
  CONSTRAINT "GameMetadataJob_gameId_fkey" FOREIGN KEY ("gameId")
    REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "GameMetadataJob_nextAttemptAt_leaseExpiresAt_idx"
  ON "GameMetadataJob"("nextAttemptAt", "leaseExpiresAt");
