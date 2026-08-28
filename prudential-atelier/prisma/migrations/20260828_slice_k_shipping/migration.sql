-- Slice K: shipping methods, parcel dims, pickup fulfilment, quote consent, FX lock.

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'READY_FOR_COLLECTION';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'COLLECTED';

CREATE TYPE "ShippingMethodKind" AS ENUM ('PICKUP', 'LOCAL_FLAT', 'CARRIER_GIG', 'CARRIER_DHL');
CREATE TYPE "ShippingQuoteStatus" AS ENUM ('NONE', 'QUOTE_PENDING', 'QUOTED', 'PAID');
CREATE TYPE "ShippingMarkupKind" AS ENUM ('PERCENT', 'FLAT');

CREATE TABLE "ShippingMethod" (
    "id" TEXT NOT NULL,
    "kind" "ShippingMethodKind" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "markupKind" "ShippingMarkupKind",
    "markupValue" DOUBLE PRECISION,
    "defaultService" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShippingMethod_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShippingMethod_kind_key" ON "ShippingMethod"("kind");

CREATE TABLE "PickupLocation" (
    "id" TEXT NOT NULL,
    "shippingMethodId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "hours" TEXT NOT NULL,
    "instructions" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PickupLocation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PickupLocation_shippingMethodId_isActive_idx" ON "PickupLocation"("shippingMethodId", "isActive");

CREATE TABLE "LagosLocation" (
    "id" TEXT NOT NULL,
    "shippingMethodId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "freeAboveNGN" DOUBLE PRECISION,
    "etaText" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LagosLocation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LagosLocation_shippingMethodId_isActive_sortOrder_idx" ON "LagosLocation"("shippingMethodId", "isActive", "sortOrder");

CREATE TABLE "PackagingProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "lengthCm" DOUBLE PRECISION NOT NULL,
    "widthCm" DOUBLE PRECISION NOT NULL,
    "heightCm" DOUBLE PRECISION NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackagingProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShippingRateLog" (
    "id" TEXT NOT NULL,
    "carrier" TEXT NOT NULL,
    "request" JSONB NOT NULL,
    "response" JSONB,
    "durationMs" INTEGER NOT NULL,
    "outcome" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShippingRateLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ShippingRateLog_carrier_createdAt_idx" ON "ShippingRateLog"("carrier", "createdAt");

CREATE TABLE "ExchangeRateSnapshot" (
    "id" TEXT NOT NULL,
    "pair" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "stale" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExchangeRateSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExchangeRateSnapshot_pair_key" ON "ExchangeRateSnapshot"("pair");

ALTER TABLE "Product" ADD COLUMN "defaultWeightKg" DOUBLE PRECISION;
ALTER TABLE "Product" ADD COLUMN "defaultLengthCm" DOUBLE PRECISION;
ALTER TABLE "Product" ADD COLUMN "defaultWidthCm" DOUBLE PRECISION;
ALTER TABLE "Product" ADD COLUMN "defaultHeightCm" DOUBLE PRECISION;
ALTER TABLE "Product" ADD COLUMN "packagingProfileId" TEXT;

CREATE INDEX "Product_packagingProfileId_idx" ON "Product"("packagingProfileId");

ALTER TABLE "ProductVariant" ADD COLUMN "weightKg" DOUBLE PRECISION;
ALTER TABLE "ProductVariant" ADD COLUMN "lengthCm" DOUBLE PRECISION;
ALTER TABLE "ProductVariant" ADD COLUMN "widthCm" DOUBLE PRECISION;
ALTER TABLE "ProductVariant" ADD COLUMN "heightCm" DOUBLE PRECISION;

ALTER TABLE "Order" ADD COLUMN "shippingMethodId" TEXT;
ALTER TABLE "Order" ADD COLUMN "shippingMethodKind" "ShippingMethodKind";
ALTER TABLE "Order" ADD COLUMN "lagosLocationId" TEXT;
ALTER TABLE "Order" ADD COLUMN "pickupLocationId" TEXT;
ALTER TABLE "Order" ADD COLUMN "shippingQuoteStatus" "ShippingQuoteStatus" NOT NULL DEFAULT 'NONE';
ALTER TABLE "Order" ADD COLUMN "shippingQuoteLocked" JSONB;
ALTER TABLE "Order" ADD COLUMN "shippingConsentAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "shippingConsentText" TEXT;
ALTER TABLE "Order" ADD COLUMN "collectionCode" TEXT;
ALTER TABLE "Order" ADD COLUMN "collectionReadyAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "collectedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "collectionRemindedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "fxRateLocked" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN "fxRateSource" TEXT;
ALTER TABLE "Order" ADD COLUMN "fxRateFetchedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "fxRateStale" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "balance" DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE INDEX "Order_shippingQuoteStatus_idx" ON "Order"("shippingQuoteStatus");
CREATE INDEX "Order_status_collectionReadyAt_idx" ON "Order"("status", "collectionReadyAt");

ALTER TABLE "PickupLocation" ADD CONSTRAINT "PickupLocation_shippingMethodId_fkey" FOREIGN KEY ("shippingMethodId") REFERENCES "ShippingMethod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LagosLocation" ADD CONSTRAINT "LagosLocation_shippingMethodId_fkey" FOREIGN KEY ("shippingMethodId") REFERENCES "ShippingMethod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_packagingProfileId_fkey" FOREIGN KEY ("packagingProfileId") REFERENCES "PackagingProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_shippingMethodId_fkey" FOREIGN KEY ("shippingMethodId") REFERENCES "ShippingMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_lagosLocationId_fkey" FOREIGN KEY ("lagosLocationId") REFERENCES "LagosLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_pickupLocationId_fkey" FOREIGN KEY ("pickupLocationId") REFERENCES "PickupLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Default garment box. DHL bills volumetric (L×W×H / 5000); the box is often heavier than the dress.
INSERT INTO "PackagingProfile" ("id", "name", "weightKg", "lengthCm", "widthCm", "heightCm", "isDefault", "createdAt", "updatedAt")
VALUES ('pkg-garment-box', 'Garment box', 0.35, 40, 30, 12, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "ShippingMethod" ("id", "kind", "name", "description", "isActive", "sortOrder", "markupKind", "markupValue", "defaultService", "createdAt", "updatedAt")
VALUES
  ('ship-pickup', 'PICKUP', 'Collect from the atelier', 'Collect in person. We will email you a collection code when the piece is ready.', true, 0, NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ship-lagos', 'LOCAL_FLAT', 'Lagos delivery', 'Flat-rate delivery within Lagos. Add or edit locations under Shipping — no deploy needed.', true, 1, NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ship-gig', 'CARRIER_GIG', 'GIG Logistics', 'Nigeria outside Lagos. Live-rated when the corporate wallet is configured; otherwise we quote personally.', true, 2, 'PERCENT', 10, 'standard', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ship-dhl', 'CARRIER_DHL', 'DHL Express', 'International. Live-rated when the DHL account is configured; otherwise we quote personally. DDU — duties are the recipient''s.', true, 3, 'PERCENT', 15, 'EXPRESS WORLDWIDE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "PickupLocation" ("id", "shippingMethodId", "name", "address", "hours", "instructions", "isActive", "sortOrder", "createdAt", "updatedAt")
VALUES (
  'pickup-surulere',
  'ship-pickup',
  'Surulere atelier',
  '14 Bode Thomas Street, Surulere, Lagos, Nigeria',
  'Monday–Friday 9:00–18:00, Saturday 10:00–16:00',
  'Bring your collection code and a matching ID. We hold pieces for 14 days.',
  true,
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- Preserve the three existing zone prices as Lagos locations so nothing is lost.
-- Nigeria Standard and International are seeded inactive — they are not Lagos rates.
INSERT INTO "LagosLocation" ("id", "shippingMethodId", "name", "price", "freeAboveNGN", "etaText", "isActive", "sortOrder", "createdAt", "updatedAt")
SELECT
  'lagos-from-express',
  'ship-lagos',
  'Lagos — Express',
  COALESCE((SELECT "flatRateNGN" FROM "ShippingZone" WHERE "name" = 'Lagos — Express' LIMIT 1), 3500),
  (SELECT "freeAboveNGN" FROM "ShippingZone" WHERE "name" = 'Lagos — Express' LIMIT 1),
  COALESCE((SELECT "estimatedDays" FROM "ShippingZone" WHERE "name" = 'Lagos — Express' LIMIT 1), '2–4 business days'),
  true,
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "LagosLocation" WHERE "id" = 'lagos-from-express');

INSERT INTO "LagosLocation" ("id", "shippingMethodId", "name", "price", "freeAboveNGN", "etaText", "isActive", "sortOrder", "createdAt", "updatedAt")
SELECT
  'lagos-from-nigeria',
  'ship-lagos',
  'Nigeria — Standard (archived zone)',
  COALESCE((SELECT "flatRateNGN" FROM "ShippingZone" WHERE "name" = 'Nigeria — Standard' LIMIT 1), 5500),
  (SELECT "freeAboveNGN" FROM "ShippingZone" WHERE "name" = 'Nigeria — Standard' LIMIT 1),
  COALESCE((SELECT "estimatedDays" FROM "ShippingZone" WHERE "name" = 'Nigeria — Standard' LIMIT 1), '4–7 business days'),
  false,
  10,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "LagosLocation" WHERE "id" = 'lagos-from-nigeria');

INSERT INTO "LagosLocation" ("id", "shippingMethodId", "name", "price", "freeAboveNGN", "etaText", "isActive", "sortOrder", "createdAt", "updatedAt")
SELECT
  'lagos-from-intl',
  'ship-lagos',
  'International (archived zone)',
  COALESCE((SELECT "flatRateNGN" FROM "ShippingZone" WHERE "name" = 'International' LIMIT 1), 45000),
  (SELECT "freeAboveNGN" FROM "ShippingZone" WHERE "name" = 'International' LIMIT 1),
  COALESCE((SELECT "estimatedDays" FROM "ShippingZone" WHERE "name" = 'International' LIMIT 1), '10–14 business days'),
  false,
  11,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "LagosLocation" WHERE "id" = 'lagos-from-intl');
