ALTER TABLE "PlatformSyncRun" ADD COLUMN "lastProgressAt" TIMESTAMP(3);
ALTER TABLE "PlatformSyncSchedulerState" ADD COLUMN "scanCursor" TEXT;
ALTER TABLE "FeedbackComment" ALTER COLUMN "authorUserId" DROP NOT NULL;
ALTER TABLE "FeedbackComment" ADD COLUMN "isSystem" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "SyncIncident" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "key" TEXT NOT NULL,
  "activeKey" TEXT,
  "provider" "ExternalProvider" NOT NULL,
  "feedbackId" TEXT NOT NULL,
  "recoveredAt" TIMESTAMP(3),
  "emailSentAt" TIMESTAMP(3),
  "emailAttempts" INTEGER NOT NULL DEFAULT 0,
  "emailNextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "emailLastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SyncIncident_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "Feedback"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SyncIncident_activeKey_key" ON "SyncIncident"("activeKey");
CREATE UNIQUE INDEX "SyncIncident_feedbackId_key" ON "SyncIncident"("feedbackId");
CREATE INDEX "SyncIncident_key_createdAt_idx" ON "SyncIncident"("key", "createdAt");
CREATE INDEX "SyncIncident_emailSentAt_emailNextAttemptAt_idx" ON "SyncIncident"("emailSentAt", "emailNextAttemptAt");
CREATE TABLE "SyncIncidentMember" (
  "incidentId" TEXT NOT NULL,
  "externalAccountId" TEXT NOT NULL,
  "accountId" TEXT,
  "runId" TEXT NOT NULL,
  "userLabel" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "errorCode" TEXT,
  "progress" INTEGER,
  "totalCount" INTEGER,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("incidentId", "externalAccountId"),
  CONSTRAINT "SyncIncidentMember_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "SyncIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SyncIncidentMember_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ExternalAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "SyncIncidentMember_externalAccountId_idx" ON "SyncIncidentMember"("externalAccountId");
CREATE INDEX "SyncIncidentMember_accountId_idx" ON "SyncIncidentMember"("accountId");
