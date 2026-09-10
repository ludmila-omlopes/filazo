-- Existing installations can predate the GOG enum values in schema.prisma.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TYPE "ExternalProvider" ADD VALUE IF NOT EXISTS 'GOG';
ALTER TYPE "EntrySource" ADD VALUE IF NOT EXISTS 'GOG';
COMMIT;
