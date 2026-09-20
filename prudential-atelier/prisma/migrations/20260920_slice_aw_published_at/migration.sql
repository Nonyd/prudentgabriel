-- Slice AW: editable product publish date for Newest first (independent of curated displayOrder).

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);

-- Preserve today's aisle order under Newest: published pieces keep the date they sorted by.
UPDATE "Product" SET "publishedAt" = "createdAt" WHERE "isPublished" = true AND "publishedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "Product_isPublished_publishedAt_idx"
  ON "Product"("isPublished", "publishedAt");
