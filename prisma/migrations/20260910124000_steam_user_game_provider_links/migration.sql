-- This model already existed in schema.prisma, but installations upgraded via
-- SQL migrations may not have the table previously created by db push.
CREATE TABLE IF NOT EXISTS "UserGameProviderLink" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "gameId" TEXT NOT NULL,
  "externalAccountId" TEXT NOT NULL,
  "provider" "ExternalProvider" NOT NULL,
  "providerGameId" TEXT NOT NULL,
  "platformName" TEXT,
  "rawData" JSONB,
  "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserGameProviderLink_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UserGameProviderLink_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserGameProviderLink_gameId_fkey" FOREIGN KEY ("gameId")
    REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserGameProviderLink_externalAccountId_fkey" FOREIGN KEY ("externalAccountId")
    REFERENCES "ExternalAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserGameProviderLink_externalAccountId_providerGameId_key"
  ON "UserGameProviderLink"("externalAccountId", "providerGameId");
CREATE INDEX IF NOT EXISTS "UserGameProviderLink_userId_gameId_idx"
  ON "UserGameProviderLink"("userId", "gameId");
CREATE INDEX IF NOT EXISTS "UserGameProviderLink_provider_providerGameId_idx"
  ON "UserGameProviderLink"("provider", "providerGameId");
