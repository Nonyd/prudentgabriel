-- Slice AM: per-document deposit %, invoice validity date.
-- Existing rows keep 70 on quotations. Invoice percent is backfilled from the
-- stored depositRequired / total so we do not rewrite the money, only label it.

ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "depositPercent" DOUBLE PRECISION NOT NULL DEFAULT 70;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);

ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "depositPercent" DOUBLE PRECISION NOT NULL DEFAULT 70;

UPDATE "Invoice"
SET "depositPercent" = ROUND(("depositRequired" / "total") * 100)
WHERE "total" > 0;
