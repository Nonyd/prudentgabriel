-- Lock USD/GBP payable onto the order (line overrides + converted extras).
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "fxGbpRateLocked" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "fxUsdAmountLocked" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "fxGbpAmountLocked" DOUBLE PRECISION;

-- Catalog min: Product.priceNGN / basePriceNGN = cheapest effective size (sale ₦ only while on sale).
UPDATE "Product" p
SET "priceNGN" = sub.min_eff,
    "basePriceNGN" = sub.min_eff
FROM (
  SELECT v."productId" AS id,
    MIN(
      CASE
        WHEN p2."isOnSale" = true AND v."salePriceNGN" IS NOT NULL THEN v."salePriceNGN"
        ELSE v."priceNGN"
      END
    ) AS min_eff
  FROM "ProductVariant" v
  JOIN "Product" p2 ON p2."id" = v."productId"
  GROUP BY v."productId"
) sub
WHERE p."id" = sub.id;
