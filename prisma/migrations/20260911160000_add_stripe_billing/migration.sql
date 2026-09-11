CREATE TABLE "BillingCustomer" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "livemode" BOOLEAN NOT NULL,
  "stripeCustomerId" TEXT,
  "checkoutSessionId" TEXT,
  "checkoutPriceId" TEXT,
  "checkoutAttempt" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "BillingCustomer_stripeCustomerId_key" ON "BillingCustomer"("stripeCustomerId");
CREATE UNIQUE INDEX "BillingCustomer_userId_livemode_key" ON "BillingCustomer"("userId", "livemode");

CREATE TABLE "BillingSubscription" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "customerId" TEXT NOT NULL REFERENCES "BillingCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "livemode" BOOLEAN NOT NULL,
  "status" TEXT NOT NULL,
  "priceId" TEXT NOT NULL,
  "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
  "paidThrough" TIMESTAMP(3),
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "BillingSubscription_userId_livemode_idx" ON "BillingSubscription"("userId", "livemode");

CREATE TABLE "BillingWebhookEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "type" TEXT NOT NULL,
  "livemode" BOOLEAN NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
