ALTER TABLE "ReleaseAnnouncement"
ADD COLUMN "sourceUrls" JSONB NOT NULL DEFAULT '[]'::jsonb;
