-- Slice AV: abandoned unpaid checkouts + product displayOrder for curated /rtw
-- ADD VALUE must commit before the new label is referenced (PG enum safety).

ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'ABANDONED';

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "displayOrder" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "Product_isPublished_isFeatured_displayOrder_idx"
  ON "Product"("isPublished", "isFeatured", "displayOrder");
