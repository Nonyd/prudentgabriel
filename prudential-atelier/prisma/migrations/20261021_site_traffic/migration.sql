-- Site traffic: aggregate counters by dimension (no visitor id) and a per-minute tally.
CREATE TABLE "AnalyticsDimDaily" (
    "id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "dim" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "AnalyticsDimDaily_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AnalyticsDimDaily_day_dim_key_key" ON "AnalyticsDimDaily"("day", "dim", "key");
CREATE INDEX "AnalyticsDimDaily_day_dim_idx" ON "AnalyticsDimDaily"("day", "dim");

CREATE TABLE "AnalyticsDimMonthly" (
    "id" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "dim" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "AnalyticsDimMonthly_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AnalyticsDimMonthly_yearMonth_dim_key_key" ON "AnalyticsDimMonthly"("yearMonth", "dim", "key");

CREATE TABLE "AnalyticsMinute" (
    "minute" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "AnalyticsMinute_pkey" PRIMARY KEY ("minute")
);
