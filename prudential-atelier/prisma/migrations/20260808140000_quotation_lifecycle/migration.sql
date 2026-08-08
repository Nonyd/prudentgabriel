-- Sprint C: quotation lifecycle (approvalUrl/pdfUrl, versioning) + document number sequences
--
-- ADD VALUE on QuoteStatus is transaction-safe on PG 16+; the new label is not
-- used in DEFAULT / CHECK / INSERT in this same file.

ALTER TYPE "QuoteStatus" ADD VALUE IF NOT EXISTS 'SUPERSEDED';

ALTER TABLE "Quotation" RENAME COLUMN "pdfUrl" TO "approvalUrl";
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "pdfUrl" TEXT;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "baseQuoteRef" TEXT;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "parentQuotationId" TEXT;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "revisedBy" TEXT;

UPDATE "Quotation" SET "baseQuoteRef" = "quoteRef" WHERE "baseQuoteRef" IS NULL;
ALTER TABLE "Quotation" ALTER COLUMN "baseQuoteRef" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "Quotation_baseQuoteRef_version_idx" ON "Quotation"("baseQuoteRef", "version");
CREATE INDEX IF NOT EXISTS "Quotation_parentQuotationId_idx" ON "Quotation"("parentQuotationId");

ALTER TABLE "Quotation"
  DROP CONSTRAINT IF EXISTS "Quotation_parentQuotationId_fkey";
ALTER TABLE "Quotation"
  ADD CONSTRAINT "Quotation_parentQuotationId_fkey"
  FOREIGN KEY ("parentQuotationId") REFERENCES "Quotation"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "DocumentNumberSequence" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DocumentNumberSequence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DocumentNumberSequence_kind_year_key"
  ON "DocumentNumberSequence"("kind", "year");
