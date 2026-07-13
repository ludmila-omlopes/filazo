CREATE TYPE "PlatformSyncTrigger" AS ENUM ('MANUAL', 'SCHEDULED');
CREATE TYPE "PlatformSyncRunStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED');

ALTER TABLE "ExternalAccount"
  ADD COLUMN "nextSyncAt" TIMESTAMP(3),
  ADD COLUMN "lastSyncAttemptAt" TIMESTAMP(3),
  ADD COLUMN "syncFailureCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastSyncErrorCode" TEXT,
  ADD COLUMN "syncLeaseToken" TEXT,
  ADD COLUMN "syncLeaseExpiresAt" TIMESTAMP(3);

CREATE TABLE "PlatformSyncRun" (
  "id" TEXT NOT NULL,
  "externalAccountId" TEXT NOT NULL,
  "provider" "ExternalProvider" NOT NULL,
  "trigger" "PlatformSyncTrigger" NOT NULL,
  "status" "PlatformSyncRunStatus" NOT NULL DEFAULT 'PENDING',
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "leaseExpiresAt" TIMESTAMP(3),
  "attempt" INTEGER NOT NULL DEFAULT 1,
  "syncedCount" INTEGER,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PlatformSyncRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformSyncSchedulerState" (
  "id" TEXT NOT NULL,
  "leaseToken" TEXT,
  "leaseExpiresAt" TIMESTAMP(3),
  "lastTriggeredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PlatformSyncSchedulerState_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExternalAccount_provider_nextSyncAt_idx" ON "ExternalAccount"("provider", "nextSyncAt");
CREATE INDEX "ExternalAccount_syncLeaseExpiresAt_idx" ON "ExternalAccount"("syncLeaseExpiresAt");
CREATE INDEX "PlatformSyncRun_externalAccountId_createdAt_idx" ON "PlatformSyncRun"("externalAccountId", "createdAt");
CREATE INDEX "PlatformSyncRun_provider_status_createdAt_idx" ON "PlatformSyncRun"("provider", "status", "createdAt");
CREATE INDEX "PlatformSyncRun_status_leaseExpiresAt_idx" ON "PlatformSyncRun"("status", "leaseExpiresAt");

ALTER TABLE "PlatformSyncRun"
  ADD CONSTRAINT "PlatformSyncRun_externalAccountId_fkey"
  FOREIGN KEY ("externalAccountId") REFERENCES "ExternalAccount"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
