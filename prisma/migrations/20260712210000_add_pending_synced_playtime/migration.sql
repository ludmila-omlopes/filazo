ALTER TABLE "UserGameEntry"
  ADD COLUMN "playtimeSource" TEXT,
  ADD COLUMN "pendingPlaytimeMinutes" INTEGER,
  ADD COLUMN "pendingPlaytimeSyncedAt" TIMESTAMP(3);
