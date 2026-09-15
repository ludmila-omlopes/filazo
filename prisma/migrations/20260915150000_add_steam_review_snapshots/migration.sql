CREATE TABLE IF NOT EXISTS "GameSteamReviewSnapshot" (
  "gameId" TEXT NOT NULL,
  "appId" TEXT NOT NULL,
  "reviews" JSONB NOT NULL,
  "summary" JSONB NOT NULL,
  "checkedAt" TIMESTAMP(3),
  "refreshLeaseToken" TEXT,
  "refreshLeaseExpiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GameSteamReviewSnapshot_pkey" PRIMARY KEY ("gameId"),
  CONSTRAINT "GameSteamReviewSnapshot_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "GameSteamReviewSnapshot_checkedAt_idx" ON "GameSteamReviewSnapshot"("checkedAt");
CREATE INDEX IF NOT EXISTS "GameSteamReviewSnapshot_refreshLeaseExpiresAt_idx" ON "GameSteamReviewSnapshot"("refreshLeaseExpiresAt");
