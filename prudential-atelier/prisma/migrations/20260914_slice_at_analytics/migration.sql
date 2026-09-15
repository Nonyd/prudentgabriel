-- Slice AT: first-party aggregate analytics. No visitor identifier is stored.

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "attribution" JSONB;
ALTER TABLE "ConsultationBooking" ADD COLUMN IF NOT EXISTS "attribution" JSONB;
ALTER TABLE "CheckoutSession" ADD COLUMN IF NOT EXISTS "attribution" JSONB;

CREATE TABLE IF NOT EXISTS "AnalyticsPageDaily" (
    "id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "path" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "AnalyticsPageDaily_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AnalyticsPageDaily_day_path_key" ON "AnalyticsPageDaily"("day", "path");
CREATE INDEX IF NOT EXISTS "AnalyticsPageDaily_day_idx" ON "AnalyticsPageDaily"("day");

CREATE TABLE IF NOT EXISTS "AnalyticsReferralDaily" (
    "id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "source" TEXT NOT NULL,
    "medium" TEXT NOT NULL DEFAULT '',
    "campaign" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL DEFAULT '',
    "count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "AnalyticsReferralDaily_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AnalyticsReferralDaily_day_source_medium_campaign_content_key" ON "AnalyticsReferralDaily"("day", "source", "medium", "campaign", "content");
CREATE INDEX IF NOT EXISTS "AnalyticsReferralDaily_day_idx" ON "AnalyticsReferralDaily"("day");

CREATE TABLE IF NOT EXISTS "AnalyticsProductDaily" (
    "id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "productId" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "AnalyticsProductDaily_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AnalyticsProductDaily_day_productId_key" ON "AnalyticsProductDaily"("day", "productId");
CREATE INDEX IF NOT EXISTS "AnalyticsProductDaily_day_idx" ON "AnalyticsProductDaily"("day");

CREATE TABLE IF NOT EXISTS "AnalyticsEventDaily" (
    "id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "AnalyticsEventDaily_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AnalyticsEventDaily_day_name_key" ON "AnalyticsEventDaily"("day", "name");
CREATE INDEX IF NOT EXISTS "AnalyticsEventDaily_day_idx" ON "AnalyticsEventDaily"("day");

CREATE TABLE IF NOT EXISTS "AnalyticsPageMonthly" (
    "id" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "AnalyticsPageMonthly_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AnalyticsPageMonthly_yearMonth_path_key" ON "AnalyticsPageMonthly"("yearMonth", "path");

CREATE TABLE IF NOT EXISTS "AnalyticsReferralMonthly" (
    "id" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "medium" TEXT NOT NULL DEFAULT '',
    "campaign" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL DEFAULT '',
    "count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "AnalyticsReferralMonthly_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AnalyticsReferralMonthly_yearMonth_source_medium_campaign_content_key" ON "AnalyticsReferralMonthly"("yearMonth", "source", "medium", "campaign", "content");

CREATE TABLE IF NOT EXISTS "AnalyticsProductMonthly" (
    "id" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "AnalyticsProductMonthly_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AnalyticsProductMonthly_yearMonth_productId_key" ON "AnalyticsProductMonthly"("yearMonth", "productId");

CREATE TABLE IF NOT EXISTS "AnalyticsEventMonthly" (
    "id" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "AnalyticsEventMonthly_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AnalyticsEventMonthly_yearMonth_name_key" ON "AnalyticsEventMonthly"("yearMonth", "name");
