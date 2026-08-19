-- Slice E: email outbox. New enum created in a DO block so re-runs are safe.
-- ADD VALUE IF NOT EXISTS is transaction-safe on PG 16+ and is not used as a
-- column DEFAULT in this same migration.

DO $$ BEGIN
  CREATE TYPE "EmailStatus" AS ENUM ('QUEUED', 'SENDING', 'SENT', 'FAILED', 'DEAD');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "AdminNotificationType" ADD VALUE IF NOT EXISTS 'EMAIL_DEAD';
ALTER TYPE "AdminNotificationType" ADD VALUE IF NOT EXISTS 'EMAIL_PROVIDER_AUTH';

CREATE TABLE IF NOT EXISTS "EmailMessage" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "cc" TEXT,
    "bcc" TEXT,
    "fromAddress" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "text" TEXT,
    "attachments" JSONB,
    "status" "EmailStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "provider" TEXT,
    "providerMessageId" TEXT,
    "sentAt" TIMESTAMP(3),
    "relatedType" TEXT,
    "relatedId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmailMessage_idempotencyKey_key" ON "EmailMessage"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "EmailMessage_status_nextAttemptAt_idx" ON "EmailMessage"("status", "nextAttemptAt");
CREATE INDEX IF NOT EXISTS "EmailMessage_relatedType_relatedId_idx" ON "EmailMessage"("relatedType", "relatedId");
CREATE INDEX IF NOT EXISTS "EmailMessage_template_idx" ON "EmailMessage"("template");
