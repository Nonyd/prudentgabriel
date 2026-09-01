-- Slice R: house size chart, custom measurements, made-to-order fulfilment.

ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'CUTTING';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'MAKING';

DO $$ BEGIN
  CREATE TYPE "SizeMode" AS ENUM ('STANDARD', 'CUSTOM');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CustomSurchargeKind" AS ENUM ('NONE', 'PERCENT', 'FLAT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "OrderFulfilmentKind" AS ENUM ('STOCK', 'MADE_TO_ORDER', 'MIXED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "customOffered" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "customSurchargeKind" "CustomSurchargeKind";
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "customSurchargeValue" DOUBLE PRECISION;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "customLeadTimeDays" INTEGER;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "customReturnable" BOOLEAN;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "fulfilmentKind" "OrderFulfilmentKind" NOT NULL DEFAULT 'STOCK';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "guestCustom" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "customLeadTimeDays" INTEGER;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "customReturnable" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "sizeMode" "SizeMode" NOT NULL DEFAULT 'STANDARD';
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "measurements" JSONB;
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "typedUnit" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "surchargeNGN" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "customLeadTimeDays" INTEGER;
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "customReturnable" BOOLEAN;

ALTER TABLE "Measurement" ADD COLUMN IF NOT EXISTS "values" JSONB;

ALTER TABLE "CartItem" ALTER COLUMN "variantId" DROP NOT NULL;
ALTER TABLE "CartItem" ADD COLUMN IF NOT EXISTS "sizeMode" "SizeMode" NOT NULL DEFAULT 'STANDARD';
ALTER TABLE "CartItem" ADD COLUMN IF NOT EXISTS "measurements" JSONB;
ALTER TABLE "CartItem" ADD COLUMN IF NOT EXISTS "typedUnit" TEXT;
ALTER TABLE "CartItem" ADD COLUMN IF NOT EXISTS "surchargeNGN" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "CartItem" ADD COLUMN IF NOT EXISTS "lineKey" TEXT;

UPDATE "CartItem"
SET "lineKey" = 'STANDARD:' || "variantId" || ':' || COALESCE("colorId", '')
WHERE "lineKey" IS NULL AND "variantId" IS NOT NULL;

DELETE FROM "CartItem" WHERE "lineKey" IS NULL;

ALTER TABLE "CartItem" ALTER COLUMN "lineKey" SET NOT NULL;

DROP INDEX IF EXISTS "CartItem_userId_variantId_colorId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "CartItem_userId_lineKey_key" ON "CartItem"("userId", "lineKey");

CREATE INDEX IF NOT EXISTS "Order_guestCustom_idx" ON "Order"("guestCustom");
CREATE INDEX IF NOT EXISTS "Order_fulfilmentKind_idx" ON "Order"("fulfilmentKind");
CREATE INDEX IF NOT EXISTS "OrderItem_sizeMode_idx" ON "OrderItem"("sizeMode");

CREATE TABLE IF NOT EXISTS "SizeChart" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SizeChart_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SizeChart_slug_key" ON "SizeChart"("slug");

CREATE TABLE IF NOT EXISTS "SizeChartRow" (
    "id" TEXT NOT NULL,
    "chartId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "bustCm" DOUBLE PRECISION,
    "waistCm" DOUBLE PRECISION,
    "hipCm" DOUBLE PRECISION,
    "lengthCm" DOUBLE PRECISION,
    CONSTRAINT "SizeChartRow_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SizeChartRow_chartId_sortOrder_idx" ON "SizeChartRow"("chartId", "sortOrder");

DO $$ BEGIN
  ALTER TABLE "SizeChartRow" ADD CONSTRAINT "SizeChartRow_chartId_fkey"
    FOREIGN KEY ("chartId") REFERENCES "SizeChart"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "MeasurementField" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'cm',
    "helpText" TEXT,
    "minCm" DOUBLE PRECISION,
    "maxCm" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MeasurementField_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MeasurementField_key_key" ON "MeasurementField"("key");

CREATE TABLE IF NOT EXISTS "ProductMeasurement" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ProductMeasurement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductMeasurement_productId_fieldId_key" ON "ProductMeasurement"("productId", "fieldId");
CREATE INDEX IF NOT EXISTS "ProductMeasurement_productId_sortOrder_idx" ON "ProductMeasurement"("productId", "sortOrder");

DO $$ BEGIN
  ALTER TABLE "ProductMeasurement" ADD CONSTRAINT "ProductMeasurement_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ProductMeasurement" ADD CONSTRAINT "ProductMeasurement_fieldId_fkey"
    FOREIGN KEY ("fieldId") REFERENCES "MeasurementField"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO "SizeChart" ("id", "name", "slug", "isDefault", "updatedAt")
VALUES ('sizechart-women', 'Women', 'women', true, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "SizeChartRow" ("id", "chartId", "label", "sortOrder", "bustCm", "waistCm", "hipCm", "lengthCm")
VALUES
  ('scr-w-6',  'sizechart-women', '6',  0, 80, 61, 86, 100),
  ('scr-w-8',  'sizechart-women', '8',  1, 83, 64, 89, 101),
  ('scr-w-10', 'sizechart-women', '10', 2, 86, 67, 92, 102),
  ('scr-w-12', 'sizechart-women', '12', 3, 90, 71, 96, 103),
  ('scr-w-14', 'sizechart-women', '14', 4, 94, 75, 100, 104),
  ('scr-w-16', 'sizechart-women', '16', 5, 98, 79, 104, 105),
  ('scr-w-18', 'sizechart-women', '18', 6, 103, 84, 109, 106),
  ('scr-w-20', 'sizechart-women', '20', 7, 108, 89, 114, 107),
  ('scr-w-22', 'sizechart-women', '22', 8, 114, 95, 120, 108)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "MeasurementField" ("id", "key", "label", "unit", "helpText", "minCm", "maxCm", "sortOrder", "updatedAt")
VALUES
  ('mf-bust', 'bust', 'Bust', 'cm', 'Measure around the fullest part of the bust, keeping the tape level.', 60, 150, 0, CURRENT_TIMESTAMP),
  ('mf-underbust', 'underbust', 'Underbust', 'cm', 'Measure directly under the bust, keeping the tape level and snug but not tight.', 55, 140, 1, CURRENT_TIMESTAMP),
  ('mf-waist', 'waist', 'Waist', 'cm', 'Measure around your natural waistline — the narrowest part of your torso.', 50, 140, 2, CURRENT_TIMESTAMP),
  ('mf-hip', 'hip', 'Hip', 'cm', 'Stand with feet together. Measure around the fullest part of the hips.', 70, 160, 3, CURRENT_TIMESTAMP),
  ('mf-shoulder', 'shoulder', 'Shoulder', 'cm', 'Measure from the edge of one shoulder to the other across your back.', 30, 55, 4, CURRENT_TIMESTAMP),
  ('mf-sleeve', 'sleeve_length', 'Sleeve length', 'cm', 'With your arm slightly bent, measure from the shoulder point to where you want the sleeve to end.', 40, 70, 5, CURRENT_TIMESTAMP),
  ('mf-inseam', 'inseam', 'Inseam', 'cm', 'Measure from the crotch down the inside of the leg to the hem.', 50, 90, 6, CURRENT_TIMESTAMP),
  ('mf-nape', 'nape_to_waist', 'Nape to waist', 'cm', 'Measure from the bone at the base of the neck down to your natural waist.', 30, 50, 7, CURRENT_TIMESTAMP),
  ('mf-length', 'total_length', 'Total length', 'cm', 'Measure from the shoulder (or waist, for skirts) down to where you want the hem to fall.', 40, 180, 8, CURRENT_TIMESTAMP),
  ('mf-thigh', 'thigh', 'Thigh', 'cm', 'Measure around the fullest part of the upper thigh.', 40, 90, 9, CURRENT_TIMESTAMP),
  ('mf-neck', 'neck', 'Neck', 'cm', 'Measure around the base of the neck, where a collar would sit.', 28, 50, 10, CURRENT_TIMESTAMP),
  ('mf-armhole', 'armhole', 'Armhole', 'cm', 'Measure around the shoulder joint where the sleeve is set in.', 30, 60, 11, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

UPDATE "Product" p
SET "customOffered" = true
WHERE EXISTS (
  SELECT 1 FROM "ProductVariant" v
  WHERE v."productId" = p.id AND lower(v.size) = 'custom'
);

INSERT INTO "SiteSetting" ("id", "key", "value", "group", "label", "type", "isPublic", "sortOrder", "updatedAt")
SELECT 'ss-r-custom-offered', 'custom_offered_default', 'false', 'STORE', 'Custom measurements — offered by default on new products', 'BOOLEAN', false, 20, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "SiteSetting" WHERE "key" = 'custom_offered_default');

INSERT INTO "SiteSetting" ("id", "key", "value", "group", "label", "type", "isPublic", "sortOrder", "updatedAt")
SELECT 'ss-r-surcharge-kind', 'custom_surcharge_kind', 'NONE', 'STORE', 'Custom measurements — surcharge (NONE, PERCENT, or FLAT)', 'TEXT', false, 21, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "SiteSetting" WHERE "key" = 'custom_surcharge_kind');

INSERT INTO "SiteSetting" ("id", "key", "value", "group", "label", "type", "isPublic", "sortOrder", "updatedAt")
SELECT 'ss-r-surcharge-val', 'custom_surcharge_value', '0', 'STORE', 'Custom measurements — surcharge amount (% or ₦)', 'NUMBER', false, 22, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "SiteSetting" WHERE "key" = 'custom_surcharge_value');

INSERT INTO "SiteSetting" ("id", "key", "value", "group", "label", "type", "isPublic", "sortOrder", "updatedAt")
SELECT 'ss-r-lead-days', 'custom_lead_time_days', '21', 'STORE', 'Custom measurements — lead time in days', 'NUMBER', false, 23, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "SiteSetting" WHERE "key" = 'custom_lead_time_days');

INSERT INTO "SiteSetting" ("id", "key", "value", "group", "label", "type", "isPublic", "sortOrder", "updatedAt")
SELECT 'ss-r-returnable', 'custom_returnable_default', 'false', 'STORE', 'Custom measurements — returnable (recommend off)', 'BOOLEAN', false, 24, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "SiteSetting" WHERE "key" = 'custom_returnable_default');
