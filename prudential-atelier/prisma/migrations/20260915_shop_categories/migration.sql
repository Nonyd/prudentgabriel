-- Shop categories become rows so the house can add and remove aisles.
-- Deleting a category moves products to Uncategorized; products are never deleted.

CREATE TABLE IF NOT EXISTS "ShopCategory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ShopCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ShopCategory_slug_key" ON "ShopCategory"("slug");

INSERT INTO "ShopCategory" ("id", "slug", "label", "sortOrder", "locked", "createdAt", "updatedAt")
VALUES
    ('scat_bridal', 'BRIDAL', 'Bridal', 10, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('scat_evening', 'EVENING_WEAR', 'Evening Wear', 20, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('scat_formal', 'FORMAL', 'Formal', 30, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('scat_casual', 'CASUAL', 'Casual', 40, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('scat_kiddies', 'KIDDIES', 'Kiddies', 50, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('scat_accessories', 'ACCESSORIES', 'Accessories', 60, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('scat_uncategorized', 'UNCATEGORIZED', 'Uncategorized', 999, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

ALTER TABLE "Product" ALTER COLUMN "category" TYPE TEXT USING "category"::text;
ALTER TABLE "Coupon" ALTER COLUMN "categoryScope" TYPE TEXT[] USING "categoryScope"::text[];

ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_category_fkey";
ALTER TABLE "Product" ADD CONSTRAINT "Product_category_fkey"
    FOREIGN KEY ("category") REFERENCES "ShopCategory"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;
