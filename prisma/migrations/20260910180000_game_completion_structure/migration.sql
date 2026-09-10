-- Additive and repeatable: safe for installations bootstrapped with db push.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $$ BEGIN
  CREATE TYPE "GameCompletionModel" AS ENUM ('UNKNOWN', 'CAMPAIGN', 'ONGOING', 'HYBRID');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "GameCompletionModelSource" AS ENUM ('METADATA', 'RULES', 'MANUAL', 'AI');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE "Game"
  ADD COLUMN IF NOT EXISTS "gameModes" JSONB,
  ADD COLUMN IF NOT EXISTS "completionModel" "GameCompletionModel" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN IF NOT EXISTS "completionModelSource" "GameCompletionModelSource",
  ADD COLUMN IF NOT EXISTS "completionModelConfidence" INTEGER,
  ADD COLUMN IF NOT EXISTS "completionModelCheckedAt" TIMESTAMP(3);
COMMIT;
