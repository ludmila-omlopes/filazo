CREATE TABLE IF NOT EXISTS "GameMarketplaceSnapshot" (
  "gameId" TEXT NOT NULL,
  "region" VARCHAR(2) NOT NULL,
  "offers" JSONB NOT NULL,
  "subscriptions" JSONB NOT NULL,
  "checkedAt" TIMESTAMP(3),
  "refreshLeaseToken" TEXT,
  "refreshLeaseExpiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GameMarketplaceSnapshot_pkey" PRIMARY KEY ("gameId", "region"),
  CONSTRAINT "GameMarketplaceSnapshot_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "GameMarketplaceSnapshot_checkedAt_idx" ON "GameMarketplaceSnapshot"("checkedAt");
CREATE INDEX IF NOT EXISTS "GameMarketplaceSnapshot_refreshLeaseExpiresAt_idx" ON "GameMarketplaceSnapshot"("refreshLeaseExpiresAt");
