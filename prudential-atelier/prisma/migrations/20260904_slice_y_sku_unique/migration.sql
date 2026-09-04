-- Slice Y: unique stock codes. Blank and colliding rows are rewritten; unique codes stay.

ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "skuManual" BOOLEAN NOT NULL DEFAULT false;

UPDATE "ProductVariant"
SET sku = 'PA-TMP-' || UPPER(SUBSTRING(REPLACE(id, '-', '') FROM 1 FOR 10))
WHERE sku IS NULL OR btrim(sku) = '';

WITH ranked AS (
  SELECT id, sku,
         ROW_NUMBER() OVER (PARTITION BY sku ORDER BY id) AS rn
  FROM "ProductVariant"
)
UPDATE "ProductVariant" AS v
SET sku = ranked.sku || '-x' || SUBSTRING(REPLACE(ranked.id, '-', '') FROM 1 FOR 6)
FROM ranked
WHERE v.id = ranked.id AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "ProductVariant_sku_key" ON "ProductVariant"("sku");
