-- Slice Z2: remake after sell-out is a separate, default-off promise.

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "customOfferedWhenSoldOut" BOOLEAN NOT NULL DEFAULT false;
