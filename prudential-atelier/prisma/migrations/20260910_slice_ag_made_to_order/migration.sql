-- Slice AG: drop garment stock; add the 48-hour fabric-unavailable record.

DROP TRIGGER IF EXISTS stock_ledger_append_only_trg ON "StockMovement";
DROP FUNCTION IF EXISTS stock_ledger_append_only();

DROP TABLE IF EXISTS "StockMovement";
DROP TABLE IF EXISTS "StockAlert";
DROP TYPE IF EXISTS "StockMovementReason";

ALTER TABLE "ProductVariant"
  DROP COLUMN IF EXISTS "stock",
  DROP COLUMN IF EXISTS "lowStockAt";

ALTER TABLE "Product"
  DROP COLUMN IF EXISTS "inStock",
  DROP COLUMN IF EXISTS "lowStockAt",
  DROP COLUMN IF EXISTS "customOfferedWhenSoldOut";

DELETE FROM "AdminNotification" WHERE type::text IN ('LOW_STOCK', 'RTW_OVERSELL');

CREATE TYPE "AdminNotificationType_new" AS ENUM (
  'NEW_ORDER',
  'BANK_TRANSFER_RECEIPT',
  'NEW_BESPOKE',
  'QUOTE_APPROVED',
  'STAGE_COMPLETED',
  'PRODUCTION_UNLOCKED',
  'NEW_CONSULTATION',
  'CONSULTATION_COMPLETED',
  'CONSULTATION_BOOKED_PRUDENT',
  'REVIEW_PENDING',
  'TESTIMONIAL_SUBMITTED',
  'PAYMENT_FAILED',
  'FABRIC_UNAVAILABLE',
  'NEW_CUSTOMER',
  'CONTACT_FORM',
  'JOB_APPLICATION',
  'STAGE_APPROVAL_RESPONSE',
  'PRODUCTION_RELOCKED',
  'QUOTE_AWAITING',
  'EMAIL_DEAD',
  'EMAIL_PROVIDER_AUTH'
);

ALTER TABLE "AdminNotification"
  ALTER COLUMN "type" TYPE "AdminNotificationType_new"
  USING ("type"::text::"AdminNotificationType_new");

DROP TYPE "AdminNotificationType";
ALTER TYPE "AdminNotificationType_new" RENAME TO "AdminNotificationType";

CREATE TYPE "FabricUnavailableChoice" AS ENUM (
  'ALTERNATIVE_OFFERED',
  'REFUNDED'
);

ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "fabricUnavailableAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "fabricUnavailableChoice" "FabricUnavailableChoice",
  ADD COLUMN IF NOT EXISTS "fabricUnavailableById" TEXT,
  ADD COLUMN IF NOT EXISTS "fabricUnavailableByName" TEXT,
  ADD COLUMN IF NOT EXISTS "fabricUnavailableNote" TEXT;

CREATE INDEX IF NOT EXISTS "Order_fabricUnavailableAt_idx" ON "Order"("fabricUnavailableAt");

DELETE FROM "SiteSetting" WHERE key IN ('notify_low_stock', 'low_stock_threshold');

INSERT INTO "SiteSetting" ("id", "key", "value", "group", "label", "type", "isPublic", "sortOrder", "updatedAt")
VALUES (
  'rtw_production_copy',
  'rtw_production_copy',
  '7-12 days',
  'STORE',
  'Ready-to-wear production time (shown on the product page, bag, checkout, and confirmation email)',
  'TEXT',
  true,
  25,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO NOTHING;

UPDATE "SiteSetting"
SET "value" = '12',
    "label" = 'Made-to-measure — lead time in days (upper bound of the house production promise)'
WHERE "key" = 'custom_lead_time_days' AND "value" = '21';
