ALTER TABLE "User" ADD COLUMN "passwordVerifiedAt" TIMESTAMP(3);

CREATE TABLE "PendingEmailRegistration" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "browserHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PendingEmailRegistration_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PendingEmailRegistration_email_key" ON "PendingEmailRegistration"("email");
CREATE UNIQUE INDEX "PendingEmailRegistration_tokenHash_key" ON "PendingEmailRegistration"("tokenHash");
CREATE INDEX "PendingEmailRegistration_expiresAt_idx" ON "PendingEmailRegistration"("expiresAt");
