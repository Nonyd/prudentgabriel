-- Slice Q: Prudent Points programme numbers, per-award expiry, birthday.

ALTER TYPE "PointsType" ADD VALUE IF NOT EXISTS 'EARNED_NEWSLETTER';
ALTER TYPE "PointsType" ADD VALUE IF NOT EXISTS 'EARNED_BIRTHDAY';
ALTER TYPE "PointsType" ADD VALUE IF NOT EXISTS 'EARNED_PROFILE';

ALTER TABLE "PointsTransaction" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
ALTER TABLE "PointsTransaction" ADD COLUMN IF NOT EXISTS "remaining" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "PointsTransaction_expiresAt_remaining_idx"
  ON "PointsTransaction"("expiresAt", "remaining");

ALTER TABLE "ClientProfile" ADD COLUMN IF NOT EXISTS "dateOfBirth" DATE;

UPDATE "PointsTransaction"
SET remaining = amount
WHERE amount > 0 AND remaining = 0;

UPDATE "PointsTransaction"
SET "expiresAt" = "createdAt" + INTERVAL '24 months'
WHERE amount > 0 AND "expiresAt" IS NULL;

UPDATE "LoyaltyRule" SET points = 12500, "isActive" = true WHERE action = 'REFERRAL_FIRST_ORDER';
UPDATE "LoyaltyRule" SET points = 500, "isActive" = true WHERE action = 'REVIEW';
UPDATE "LoyaltyRule" SET "isActive" = false WHERE action IN ('SIGNUP_REFERRAL', 'PURCHASE_PER_100');

INSERT INTO "LoyaltyRule" (id, action, points, "isActive")
SELECT 'qpp_purchase_per_10', 'PURCHASE_PER_10', 1, true
WHERE NOT EXISTS (SELECT 1 FROM "LoyaltyRule" WHERE action = 'PURCHASE_PER_10');

INSERT INTO "LoyaltyRule" (id, action, points, "isActive")
SELECT 'qpp_newsletter', 'NEWSLETTER', 500, true
WHERE NOT EXISTS (SELECT 1 FROM "LoyaltyRule" WHERE action = 'NEWSLETTER');

INSERT INTO "LoyaltyRule" (id, action, points, "isActive")
SELECT 'qpp_birthday', 'BIRTHDAY', 2500, true
WHERE NOT EXISTS (SELECT 1 FROM "LoyaltyRule" WHERE action = 'BIRTHDAY');

INSERT INTO "LoyaltyRule" (id, action, points, "isActive")
SELECT 'qpp_style_profile', 'STYLE_PROFILE', 1000, true
WHERE NOT EXISTS (SELECT 1 FROM "LoyaltyRule" WHERE action = 'STYLE_PROFILE');
