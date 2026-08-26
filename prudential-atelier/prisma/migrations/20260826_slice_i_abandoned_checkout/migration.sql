-- Slice I: abandoned checkout sessions (email captured at step 1).

CREATE TABLE IF NOT EXISTS "CheckoutSession" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT,
    "cartSnapshot" JSONB NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "furthestStep" INTEGER NOT NULL DEFAULT 1,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recoveredAt" TIMESTAMP(3),
    "orderId" TEXT,
    "remindersSent" INTEGER NOT NULL DEFAULT 0,
    "restoreToken" TEXT NOT NULL,
    "lastReminderAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckoutSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CheckoutSession_restoreToken_key" ON "CheckoutSession"("restoreToken");
CREATE INDEX IF NOT EXISTS "CheckoutSession_email_recoveredAt_idx" ON "CheckoutSession"("email", "recoveredAt");
CREATE INDEX IF NOT EXISTS "CheckoutSession_lastActiveAt_recoveredAt_remindersSent_idx" ON "CheckoutSession"("lastActiveAt", "recoveredAt", "remindersSent");
