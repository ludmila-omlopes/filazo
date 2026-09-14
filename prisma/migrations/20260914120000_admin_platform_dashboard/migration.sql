CREATE TABLE "UserDailyActivity" (
  "userId" TEXT NOT NULL,
  "day" DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserDailyActivity_pkey" PRIMARY KEY ("userId", "day"),
  CONSTRAINT "UserDailyActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "UserDailyActivity_day_idx" ON "UserDailyActivity"("day");

CREATE TABLE "PlatformError" (
  "id" TEXT NOT NULL,
  "route" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformError_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PlatformError_environment_createdAt_idx" ON "PlatformError"("environment", "createdAt");
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");
CREATE INDEX "Game_createdAt_idx" ON "Game"("createdAt");
CREATE INDEX "UserGameEntry_createdAt_idx" ON "UserGameEntry"("createdAt");
