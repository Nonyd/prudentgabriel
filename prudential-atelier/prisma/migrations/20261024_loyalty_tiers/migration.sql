-- Tiers follow naira paid per calendar year; perks are editable; the tier correction email is sent once.
CREATE TABLE "LoyaltyTierConfig" (
    "tier" "LoyaltyTier" NOT NULL,
    "minSpendNGN" DOUBLE PRECISION NOT NULL,
    "pointsPer100" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    CONSTRAINT "LoyaltyTierConfig_pkey" PRIMARY KEY ("tier")
);

CREATE TABLE "LoyaltyPerk" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "tiers" "LoyaltyTier"[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LoyaltyPerk_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LoyaltyCorrectionNotice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "previousTier" "LoyaltyTier" NOT NULL,
    "correctTier" "LoyaltyTier" NOT NULL,
    "note" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentById" TEXT,
    CONSTRAINT "LoyaltyCorrectionNotice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LoyaltyCorrectionNotice_userId_key" ON "LoyaltyCorrectionNotice"("userId");

INSERT INTO "LoyaltyTierConfig" ("tier", "minSpendNGN", "pointsPer100", "updatedAt") VALUES
  ('BRONZE', 0, 3, CURRENT_TIMESTAMP),
  ('SILVER', 10000000, 3, CURRENT_TIMESTAMP),
  ('GOLD', 20000000, 3, CURRENT_TIMESTAMP),
  ('PLATINUM', 30000000, 3, CURRENT_TIMESTAMP);

INSERT INTO "LoyaltyPerk" ("id", "label", "tiers", "sortOrder", "updatedAt") VALUES
  ('perk_birthday',   'Birthday points every year',                          ARRAY['BRONZE','SILVER','GOLD','PLATINUM']::"LoyaltyTier"[], 0, CURRENT_TIMESTAMP),
  ('perk_firstlook',  'First look at new collections by email',              ARRAY['BRONZE','SILVER','GOLD','PLATINUM']::"LoyaltyTier"[], 1, CURRENT_TIMESTAMP),
  ('perk_early',      '48-hour early access to new collections',             ARRAY['SILVER','GOLD','PLATINUM']::"LoyaltyTier"[], 2, CURRENT_TIMESTAMP),
  ('perk_delivery',   'Free delivery within Lagos',                          ARRAY['SILVER','GOLD','PLATINUM']::"LoyaltyTier"[], 3, CURRENT_TIMESTAMP),
  ('perk_priority',   'Priority production slot',                            ARRAY['SILVER','GOLD','PLATINUM']::"LoyaltyTier"[], 4, CURRENT_TIMESTAMP),
  ('perk_consult',    '1 complimentary consultation per year',               ARRAY['GOLD','PLATINUM']::"LoyaltyTier"[], 5, CURRENT_TIMESTAMP),
  ('perk_alter_rtw',  'Complimentary alterations on ready-to-wear',          ARRAY['GOLD']::"LoyaltyTier"[], 6, CURRENT_TIMESTAMP),
  ('perk_preview',    'Invitations to private previews',                     ARRAY['GOLD','PLATINUM']::"LoyaltyTier"[], 7, CURRENT_TIMESTAMP),
  ('perk_whatsapp',   'Priority WhatsApp line',                              ARRAY['GOLD','PLATINUM']::"LoyaltyTier"[], 8, CURRENT_TIMESTAMP),
  ('perk_advisor',    'A dedicated client advisor',                          ARRAY['PLATINUM']::"LoyaltyTier"[], 9, CURRENT_TIMESTAMP),
  ('perk_alter_all',  'Complimentary alterations',                           ARRAY['PLATINUM']::"LoyaltyTier"[], 10, CURRENT_TIMESTAMP),
  ('perk_home',       'Home fittings in Lagos',                              ARRAY['PLATINUM']::"LoyaltyTier"[], 11, CURRENT_TIMESTAMP),
  ('perk_events',     'Invitations to shows and events',                     ARRAY['PLATINUM']::"LoyaltyTier"[], 12, CURRENT_TIMESTAMP),
  ('perk_firstpick',  'First pick of one-of-a-kind pieces',                  ARRAY['PLATINUM']::"LoyaltyTier"[], 13, CURRENT_TIMESTAMP),
  ('perk_gift',       'An annual gift from the house',                       ARRAY['PLATINUM']::"LoyaltyTier"[], 14, CURRENT_TIMESTAMP),
  ('perk_rush',       'Rush production at no charge',                        ARRAY['PLATINUM']::"LoyaltyTier"[], 15, CURRENT_TIMESTAMP);

-- Shop orders now earn per ₦100 at the tier rate; atelier payments earn a flat rate.
UPDATE "LoyaltyRule" SET "isActive" = false WHERE "action" = 'PURCHASE_PER_10';
INSERT INTO "LoyaltyRule" ("id", "action", "points", "isActive") VALUES ('rule_atelier_per_100', 'ATELIER_PER_100', 2, true)
  ON CONFLICT ("action") DO NOTHING;

-- The balance-based stopgap thresholds are no longer read.
DELETE FROM "SiteSetting" WHERE "key" IN ('loyalty_threshold_bronze', 'loyalty_threshold_silver', 'loyalty_threshold_gold', 'loyalty_threshold_platinum');
