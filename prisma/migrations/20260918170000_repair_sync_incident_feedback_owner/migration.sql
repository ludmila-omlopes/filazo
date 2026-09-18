-- Existing deployments that predate anonymous authentication feedback can retain
-- a NOT NULL owner column even after the incident-monitor tables are installed.
-- Incidents are system-owned, so they intentionally have no userId.
ALTER TABLE "Feedback" DROP CONSTRAINT IF EXISTS "Feedback_userId_fkey";
ALTER TABLE "Feedback" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "Feedback"
  ADD CONSTRAINT "Feedback_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
