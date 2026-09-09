-- Auth failures can be reported before a user can establish a session.
ALTER TABLE "Feedback" DROP CONSTRAINT "Feedback_userId_fkey";

ALTER TABLE "Feedback" ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "Feedback"
  ADD CONSTRAINT "Feedback_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
