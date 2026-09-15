CREATE TABLE "UserGamePlayDate" (
  "userId" TEXT NOT NULL,
  "gameId" TEXT NOT NULL,
  "provider" "ExternalProvider" NOT NULL,
  "day" DATE NOT NULL,
  "kind" TEXT NOT NULL,
  "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserGamePlayDate_pkey" PRIMARY KEY ("userId", "gameId", "provider", "day", "kind"),
  CONSTRAINT "UserGamePlayDate_kind_check" CHECK ("kind" IN ('first_played', 'played')),
  CONSTRAINT "UserGamePlayDate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserGamePlayDate_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "UserGamePlayDate_userId_day_idx" ON "UserGamePlayDate"("userId", "day");
