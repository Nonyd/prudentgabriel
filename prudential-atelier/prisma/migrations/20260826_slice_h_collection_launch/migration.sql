-- Slice H: marketing unsubscribe, campaign priority, unpublished defaults.

ALTER TABLE "Product" ALTER COLUMN "isPublished" SET DEFAULT false;
ALTER TABLE "Collection" ALTER COLUMN "isPublished" SET DEFAULT false;

ALTER TABLE "NewsletterSubscriber" ADD COLUMN IF NOT EXISTS "unsubscribedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "EmailPreference" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "unsubscribeToken" TEXT NOT NULL,
    "unsubscribedAt" TIMESTAMP(3),
    "bounceAt" TIMESTAMP(3),
    "bounceReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmailPreference_email_key" ON "EmailPreference"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "EmailPreference_unsubscribeToken_key" ON "EmailPreference"("unsubscribeToken");
CREATE INDEX IF NOT EXISTS "EmailPreference_unsubscribedAt_idx" ON "EmailPreference"("unsubscribedAt");

ALTER TABLE "EmailSendJob" ADD COLUMN IF NOT EXISTS "collectionId" TEXT;

ALTER TABLE "EmailMessage" ADD COLUMN IF NOT EXISTS "priority" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "EmailMessage" ADD COLUMN IF NOT EXISTS "headers" JSONB;

CREATE INDEX IF NOT EXISTS "EmailMessage_priority_status_nextAttemptAt_idx"
  ON "EmailMessage"("priority", "status", "nextAttemptAt");
