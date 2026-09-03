-- Slice V: stock ledger. ProductVariant.stock becomes a cache of StockMovement.delta.

CREATE TYPE "StockMovementReason" AS ENUM (
  'SALE',
  'CANCEL_RETURN',
  'REFUND_RETURN',
  'COUNT_CORRECTION',
  'RECEIPT',
  'WRITE_OFF',
  'OPENING'
);

ALTER TABLE "ProductVariant"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS "StockMovement" (
  "id" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "delta" INTEGER NOT NULL,
  "reason" "StockMovementReason" NOT NULL,
  "orderId" TEXT,
  "actorId" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StockMovement_variantId_createdAt_idx"
  ON "StockMovement"("variantId", "createdAt");
CREATE INDEX IF NOT EXISTS "StockMovement_orderId_idx"
  ON "StockMovement"("orderId");

DO $$ BEGIN
  ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_variantId_fkey"
    FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Opening balances: honest current stock, no reconstructed history.
INSERT INTO "StockMovement" ("id", "variantId", "delta", "reason", "createdAt")
SELECT 'open_' || v.id, v.id, v.stock, 'OPENING', CURRENT_TIMESTAMP
FROM "ProductVariant" v
WHERE v.stock <> 0
  AND NOT EXISTS (
    SELECT 1 FROM "StockMovement" sm WHERE sm."variantId" = v.id
  );

CREATE OR REPLACE FUNCTION stock_ledger_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('app.ledger_bypass', true) = 'on' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Stock ledger is append-only: DELETE is not allowed (id=%)', OLD.id;
  END IF;

  IF NEW.delta IS DISTINCT FROM OLD.delta THEN
    RAISE EXCEPTION 'Stock ledger is append-only: column "delta" cannot be updated (id=%). Insert a correction row instead.', OLD.id;
  END IF;
  IF NEW.reason IS DISTINCT FROM OLD.reason THEN
    RAISE EXCEPTION 'Stock ledger is append-only: column "reason" cannot be updated (id=%).', OLD.id;
  END IF;
  IF NEW."variantId" IS DISTINCT FROM OLD."variantId" THEN
    RAISE EXCEPTION 'Stock ledger is append-only: column "variantId" cannot be updated (id=%).', OLD.id;
  END IF;
  IF NEW."orderId" IS DISTINCT FROM OLD."orderId" THEN
    RAISE EXCEPTION 'Stock ledger is append-only: column "orderId" cannot be updated (id=%).', OLD.id;
  END IF;
  IF NEW."actorId" IS DISTINCT FROM OLD."actorId" THEN
    RAISE EXCEPTION 'Stock ledger is append-only: column "actorId" cannot be updated (id=%).', OLD.id;
  END IF;
  IF NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'Stock ledger is append-only: column "createdAt" cannot be updated (id=%).', OLD.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stock_ledger_append_only_trg ON "StockMovement";
CREATE TRIGGER stock_ledger_append_only_trg
  BEFORE UPDATE OR DELETE ON "StockMovement"
  FOR EACH ROW
  EXECUTE PROCEDURE stock_ledger_append_only();
