-- AlterTable
ALTER TABLE "Game"
ADD COLUMN "igdbCheckedAt" TIMESTAMP(3),
ADD COLUMN "hltbCheckedAt" TIMESTAMP(3),
ADD COLUMN "metacriticCheckedAt" TIMESTAMP(3);
