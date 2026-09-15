ALTER TABLE "GameSteamReviewSnapshot"
ADD COLUMN IF NOT EXISTS "language" TEXT NOT NULL DEFAULT 'english';

ALTER TABLE "GameSteamReviewSnapshot"
DROP CONSTRAINT IF EXISTS "GameSteamReviewSnapshot_pkey";

ALTER TABLE "GameSteamReviewSnapshot"
ADD CONSTRAINT "GameSteamReviewSnapshot_pkey" PRIMARY KEY ("gameId", "language");

ALTER TABLE "GameSteamReviewSnapshot"
ALTER COLUMN "language" DROP DEFAULT;
