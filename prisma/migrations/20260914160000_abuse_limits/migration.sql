CREATE TABLE IF NOT EXISTS "AbuseLimitBucket" (
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AbuseLimitBucket_pkey" PRIMARY KEY ("key")
);
CREATE INDEX IF NOT EXISTS "AbuseLimitBucket_expiresAt_idx" ON "AbuseLimitBucket"("expiresAt");
