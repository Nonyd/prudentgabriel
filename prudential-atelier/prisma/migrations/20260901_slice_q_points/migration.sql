-- Slice Q: pay with Prudential Points.
-- Rate history, locked redemption rate, ledger purpose for points as partial payment.

ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'POINTS';
ALTER TYPE "PaymentPurpose" ADD VALUE IF NOT EXISTS 'POINTS_REDEMPTION';
ALTER TYPE "PointsType" ADD VALUE IF NOT EXISTS 'RETURNED';

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "pointsRateLocked" DOUBLE PRECISION;

ALTER TABLE "PointsTransaction" ADD COLUMN IF NOT EXISTS "rateNGN" DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS "PointsTransaction_userId_createdAt_idx" ON "PointsTransaction"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "PointsTransaction_orderId_idx" ON "PointsTransaction"("orderId");

CREATE TABLE IF NOT EXISTS "PointRateHistory" (
    "id" TEXT NOT NULL,
    "rateNGN" DOUBLE PRECISION NOT NULL,
    "previousRateNGN" DOUBLE PRECISION,
    "changedById" TEXT,
    "outstandingPoints" INTEGER NOT NULL,
    "liabilityNGN" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointRateHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PointRateHistory_createdAt_idx" ON "PointRateHistory"("createdAt");

DO $$ BEGIN
  ALTER TABLE "PointRateHistory" ADD CONSTRAINT "PointRateHistory_changedById_fkey"
    FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
