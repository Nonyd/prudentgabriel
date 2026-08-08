-- Sprint A payment ledger
-- Case 3.1: enum values CONFIRMED/REJECTED are ADDED but never USED in this
-- migration (no DEFAULT, CHECK, or data UPDATE referencing them). Safe in one file.
--
-- Note: IF NOT EXISTS / duplicate_object wrappers are intentional for this one-shot
-- migration verified against a production clone. Future migrations should be plain.

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('PAYSTACK', 'FLUTTERWAVE', 'STRIPE', 'MONNIFY', 'BANK_TRANSFER', 'MANUAL');

-- CreateEnum
CREATE TYPE "PaymentPurpose" AS ENUM ('DEPOSIT', 'BALANCE', 'FULL', 'CONSULTATION', 'RTW_ORDER');

-- AlterEnum — new values unused until commit (no same-tx references)
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'CONFIRMED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

-- AlterTable
ALTER TABLE "BespokeOrder" ADD COLUMN IF NOT EXISTS "productionUnlockedAt" TIMESTAMP(3);

-- AlterTable — nullable: every existing invoice predates this FK
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "quotationId" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Payment" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "purpose" "PaymentPurpose" NOT NULL,
    "receiptUrl" TEXT,
    "gatewayPayload" JSONB,
    "invoiceId" TEXT,
    "bespokeOrderId" TEXT,
    "consultationId" TEXT,
    "orderId" TEXT,
    "clientId" TEXT NOT NULL,
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_reference_key" ON "Payment"("reference");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Payment_bespokeOrderId_idx" ON "Payment"("bespokeOrderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Payment_invoiceId_idx" ON "Payment"("invoiceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Payment_clientId_idx" ON "Payment"("clientId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Payment_orderId_idx" ON "Payment"("orderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Payment_consultationId_idx" ON "Payment"("consultationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invoice_quotationId_idx" ON "Invoice"("quotationId");

-- AddForeignKey (SET NULL on quotation — optional link for pre-existing invoices)
DO $$ BEGIN
  ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_quotationId_fkey"
    FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Ledger FKs: RESTRICT so deleting a parent fails loudly (append-only ledger)
DO $$ BEGIN
  ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bespokeOrderId_fkey"
    FOREIGN KEY ("bespokeOrderId") REFERENCES "BespokeOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Payment" ADD CONSTRAINT "Payment_consultationId_fkey"
    FOREIGN KEY ("consultationId") REFERENCES "ConsultationBooking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Payment" ADD CONSTRAINT "Payment_confirmedById_fkey"
    FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Append-only enforcement with session-scoped bypass (app.ledger_bypass = 'on').
-- Immutable: amount, currency, purpose, reference, entity FKs, clientId, createdAt.
-- Mutable: status, confirmedAt, confirmedById, rejectedReason, receiptUrl, gatewayPayload, updatedAt.
CREATE OR REPLACE FUNCTION payment_ledger_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Escape hatch for audited human corrections at a psql prompt only.
  -- Application code must never set this. Usage:
  --   BEGIN;
  --   SET LOCAL app.ledger_bypass = 'on';
  --   -- corrective SQL --
  --   COMMIT;
  IF current_setting('app.ledger_bypass', true) = 'on' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Payment ledger is append-only: DELETE is not allowed (id=%)', OLD.id;
  END IF;

  -- TG_OP = 'UPDATE'
  IF NEW.amount IS DISTINCT FROM OLD.amount THEN
    RAISE EXCEPTION 'Payment ledger is append-only: column "amount" cannot be updated (id=%). Insert a correction row instead.', OLD.id;
  END IF;
  IF NEW.currency IS DISTINCT FROM OLD.currency THEN
    RAISE EXCEPTION 'Payment ledger is append-only: column "currency" cannot be updated (id=%).', OLD.id;
  END IF;
  IF NEW.purpose IS DISTINCT FROM OLD.purpose THEN
    RAISE EXCEPTION 'Payment ledger is append-only: column "purpose" cannot be updated (id=%).', OLD.id;
  END IF;
  IF NEW.reference IS DISTINCT FROM OLD.reference THEN
    RAISE EXCEPTION 'Payment ledger is append-only: column "reference" cannot be updated (id=%).', OLD.id;
  END IF;
  IF NEW."invoiceId" IS DISTINCT FROM OLD."invoiceId" THEN
    RAISE EXCEPTION 'Payment ledger is append-only: column "invoiceId" cannot be updated (id=%).', OLD.id;
  END IF;
  IF NEW."bespokeOrderId" IS DISTINCT FROM OLD."bespokeOrderId" THEN
    RAISE EXCEPTION 'Payment ledger is append-only: column "bespokeOrderId" cannot be updated (id=%).', OLD.id;
  END IF;
  IF NEW."consultationId" IS DISTINCT FROM OLD."consultationId" THEN
    RAISE EXCEPTION 'Payment ledger is append-only: column "consultationId" cannot be updated (id=%).', OLD.id;
  END IF;
  IF NEW."orderId" IS DISTINCT FROM OLD."orderId" THEN
    RAISE EXCEPTION 'Payment ledger is append-only: column "orderId" cannot be updated (id=%).', OLD.id;
  END IF;
  IF NEW."clientId" IS DISTINCT FROM OLD."clientId" THEN
    RAISE EXCEPTION 'Payment ledger is append-only: column "clientId" cannot be updated (id=%).', OLD.id;
  END IF;
  IF NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'Payment ledger is append-only: column "createdAt" cannot be updated (id=%).', OLD.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payment_ledger_append_only_trg ON "Payment";
CREATE TRIGGER payment_ledger_append_only_trg
  BEFORE UPDATE OR DELETE ON "Payment"
  FOR EACH ROW
  EXECUTE PROCEDURE payment_ledger_append_only();
