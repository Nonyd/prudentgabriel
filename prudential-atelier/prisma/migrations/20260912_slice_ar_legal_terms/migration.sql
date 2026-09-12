-- Slice AR: snapshot the legal terms version onto shop orders and quotations.

ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "legalTermsVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "legalTermsSnapshot" JSONB;

ALTER TABLE "Quotation"
  ADD COLUMN IF NOT EXISTS "legalTermsVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "legalTermsSnapshot" JSONB;
