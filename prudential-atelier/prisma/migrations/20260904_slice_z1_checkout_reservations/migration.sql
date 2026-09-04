-- Slice Z1: checkout reservations (coupon/points hold until payment confirms)
-- and oversell refund attribution.

ALTER TYPE "PointsType" ADD VALUE IF NOT EXISTS 'RESERVED';

DO $$ BEGIN
  CREATE TYPE "CouponUsageStatus" AS ENUM ('PENDING', 'COMMITTED', 'RELEASED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "CouponUsage" ADD COLUMN IF NOT EXISTS "status" "CouponUsageStatus" NOT NULL DEFAULT 'COMMITTED';
ALTER TABLE "CouponUsage" ADD COLUMN IF NOT EXISTS "committedAt" TIMESTAMP(3);
ALTER TABLE "CouponUsage" ADD COLUMN IF NOT EXISTS "releasedAt" TIMESTAMP(3);

UPDATE "CouponUsage"
SET "status" = 'COMMITTED', "committedAt" = COALESCE("committedAt", "usedAt")
WHERE "status" IS NULL OR "status" = 'COMMITTED';

CREATE INDEX IF NOT EXISTS "CouponUsage_couponId_status_idx"
  ON "CouponUsage"("couponId", "status");

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "refundRecordedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "refundRecordedById" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "refundRecordedByName" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "refundRecordedAmountNGN" DOUBLE PRECISION;
