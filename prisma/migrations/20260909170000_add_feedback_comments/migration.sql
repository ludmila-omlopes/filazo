CREATE TABLE "FeedbackComment" (
  "id" TEXT NOT NULL,
  "feedbackId" TEXT NOT NULL,
  "authorUserId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FeedbackComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FeedbackComment_feedbackId_createdAt_idx" ON "FeedbackComment"("feedbackId", "createdAt");
CREATE INDEX "FeedbackComment_authorUserId_createdAt_idx" ON "FeedbackComment"("authorUserId", "createdAt");

ALTER TABLE "FeedbackComment"
  ADD CONSTRAINT "FeedbackComment_feedbackId_fkey"
  FOREIGN KEY ("feedbackId") REFERENCES "Feedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FeedbackComment"
  ADD CONSTRAINT "FeedbackComment_authorUserId_fkey"
  FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
