-- Sprint D: post-delivery loop (receipt confirm, alterations, archive, review markers)
--
-- ADD VALUE on enums is transaction-safe on PG 16+; new labels are not used as
-- column DEFAULTs in this same migration.

ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';

ALTER TYPE "CustomerNotificationType" ADD VALUE IF NOT EXISTS 'RECEIPT_CONFIRMATION_REQUESTED';
ALTER TYPE "CustomerNotificationType" ADD VALUE IF NOT EXISTS 'RECEIPT_CONFIRMED';
ALTER TYPE "CustomerNotificationType" ADD VALUE IF NOT EXISTS 'ALTERATION_UPDATE';

DO $$ BEGIN
  CREATE TYPE "AlterationReason" AS ENUM ('FIT', 'WORKMANSHIP', 'DAMAGE', 'CHANGE_REQUESTED', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AlterationStatus" AS ENUM ('REQUESTED', 'ACCEPTED', 'DECLINED', 'IN_PROGRESS', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AlterationPricing" AS ENUM ('FREE', 'CHARGEABLE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "BespokeOrder" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3);
ALTER TABLE "BespokeOrder" ADD COLUMN IF NOT EXISTS "receiptConfirmToken" TEXT;
ALTER TABLE "BespokeOrder" ADD COLUMN IF NOT EXISTS "receiptConfirmedAt" TIMESTAMP(3);
ALTER TABLE "BespokeOrder" ADD COLUMN IF NOT EXISTS "receiptConfirmedById" TEXT;
ALTER TABLE "BespokeOrder" ADD COLUMN IF NOT EXISTS "receiptReminderSentAt" TIMESTAMP(3);
ALTER TABLE "BespokeOrder" ADD COLUMN IF NOT EXISTS "reviewRequestSent" BOOLEAN NOT NULL DEFAULT false;

-- Backfill unique tokens for existing rows before NOT NULL / unique constraint
UPDATE "BespokeOrder"
SET "receiptConfirmToken" = md5(random()::text || id || clock_timestamp()::text)
WHERE "receiptConfirmToken" IS NULL;

ALTER TABLE "BespokeOrder" ALTER COLUMN "receiptConfirmToken" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "BespokeOrder_receiptConfirmToken_key" ON "BespokeOrder"("receiptConfirmToken");
CREATE INDEX IF NOT EXISTS "BespokeOrder_deliveredAt_receiptConfirmedAt_idx" ON "BespokeOrder"("deliveredAt", "receiptConfirmedAt");

ALTER TABLE "BespokeOrder"
  DROP CONSTRAINT IF EXISTS "BespokeOrder_receiptConfirmedById_fkey";
ALTER TABLE "BespokeOrder"
  ADD CONSTRAINT "BespokeOrder_receiptConfirmedById_fkey"
  FOREIGN KEY ("receiptConfirmedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "AlterationRequest" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "media" JSONB NOT NULL DEFAULT '[]',
    "reason" "AlterationReason" NOT NULL,
    "status" "AlterationStatus" NOT NULL DEFAULT 'REQUESTED',
    "pricingDefault" "AlterationPricing",
    "pricingDecision" "AlterationPricing",
    "pricingOverrideReason" TEXT,
    "complimentaryEstimatedValue" DOUBLE PRECISION,
    "declineReason" TEXT,
    "quotationId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlterationRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AlterationRequest_orderId_status_idx" ON "AlterationRequest"("orderId", "status");
CREATE INDEX IF NOT EXISTS "AlterationRequest_clientId_idx" ON "AlterationRequest"("clientId");
CREATE INDEX IF NOT EXISTS "AlterationRequest_status_idx" ON "AlterationRequest"("status");

ALTER TABLE "AlterationRequest"
  DROP CONSTRAINT IF EXISTS "AlterationRequest_orderId_fkey";
ALTER TABLE "AlterationRequest"
  ADD CONSTRAINT "AlterationRequest_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "BespokeOrder"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AlterationRequest"
  DROP CONSTRAINT IF EXISTS "AlterationRequest_clientId_fkey";
ALTER TABLE "AlterationRequest"
  ADD CONSTRAINT "AlterationRequest_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "ClientProfile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AlterationRequest"
  DROP CONSTRAINT IF EXISTS "AlterationRequest_quotationId_fkey";
ALTER TABLE "AlterationRequest"
  ADD CONSTRAINT "AlterationRequest_quotationId_fkey"
  FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "SiteSetting" ("id", "key", "value", "group", "label", "type", "isPublic", "sortOrder", "updatedAt")
VALUES (
  'cl_alteration_warranty_days',
  'alteration_warranty_days',
  '30',
  'PAYMENTS'::"SettingGroup",
  'Alteration warranty (days)',
  'NUMBER'::"SettingType",
  false,
  26,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO NOTHING;
