import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import {
  ANALYTICS_DAILY_RETENTION_DEFAULT,
  ANALYTICS_DAILY_RETENTION_KEY,
} from "@/lib/analytics/paths";
import { analyticsDayUtc } from "@/lib/analytics/record";
import { FINANCE_TZ } from "@/lib/finance/aa0";

function yearMonthOf(day: Date): string {
  return `${day.getUTCFullYear()}-${String(day.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Keep daily rows for complete months that still overlap the retention window. Roll older months. */
export async function rollupAnalyticsDaily(now = new Date()): Promise<{ rolledDays: number; deleted: number }> {
  const raw = await getSetting(ANALYTICS_DAILY_RETENTION_KEY);
  const days = Math.max(30, Math.min(730, Number(raw) || ANALYTICS_DAILY_RETENTION_DEFAULT));
  const cutoff = analyticsDayUtc(new Date(now.getTime() - days * 24 * 60 * 60 * 1000));
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: FINANCE_TZ,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(cutoff);
  const cy = Number(parts.find((p) => p.type === "year")?.value);
  const cm = Number(parts.find((p) => p.type === "month")?.value);
  const firstOfCutoffMonth = new Date(Date.UTC(cy, cm - 1, 1));

  const oldPages = await prisma.analyticsPageDaily.findMany({
    where: { day: { lt: firstOfCutoffMonth } },
  });
  const oldRefs = await prisma.analyticsReferralDaily.findMany({
    where: { day: { lt: firstOfCutoffMonth } },
  });
  const oldProducts = await prisma.analyticsProductDaily.findMany({
    where: { day: { lt: firstOfCutoffMonth } },
  });
  const oldEvents = await prisma.analyticsEventDaily.findMany({
    where: { day: { lt: firstOfCutoffMonth } },
  });

  for (const row of oldPages) {
    const yearMonth = yearMonthOf(row.day);
    await prisma.analyticsPageMonthly.upsert({
      where: { yearMonth_path: { yearMonth, path: row.path } },
      create: { yearMonth, path: row.path, count: row.count },
      update: { count: { increment: row.count } },
    });
  }
  for (const row of oldRefs) {
    const yearMonth = yearMonthOf(row.day);
    await prisma.analyticsReferralMonthly.upsert({
      where: {
        yearMonth_source_medium_campaign_content: {
          yearMonth,
          source: row.source,
          medium: row.medium,
          campaign: row.campaign,
          content: row.content,
        },
      },
      create: {
        yearMonth,
        source: row.source,
        medium: row.medium,
        campaign: row.campaign,
        content: row.content,
        count: row.count,
      },
      update: { count: { increment: row.count } },
    });
  }
  for (const row of oldProducts) {
    const yearMonth = yearMonthOf(row.day);
    await prisma.analyticsProductMonthly.upsert({
      where: { yearMonth_productId: { yearMonth, productId: row.productId } },
      create: { yearMonth, productId: row.productId, count: row.count },
      update: { count: { increment: row.count } },
    });
  }
  for (const row of oldEvents) {
    const yearMonth = yearMonthOf(row.day);
    await prisma.analyticsEventMonthly.upsert({
      where: { yearMonth_name: { yearMonth, name: row.name } },
      create: { yearMonth, name: row.name, count: row.count },
      update: { count: { increment: row.count } },
    });
  }

  const deletedPages = await prisma.analyticsPageDaily.deleteMany({ where: { day: { lt: firstOfCutoffMonth } } });
  const deletedRefs = await prisma.analyticsReferralDaily.deleteMany({ where: { day: { lt: firstOfCutoffMonth } } });
  const deletedProducts = await prisma.analyticsProductDaily.deleteMany({
    where: { day: { lt: firstOfCutoffMonth } },
  });
  const deletedEvents = await prisma.analyticsEventDaily.deleteMany({ where: { day: { lt: firstOfCutoffMonth } } });

  return {
    rolledDays: oldPages.length + oldRefs.length + oldProducts.length + oldEvents.length,
    deleted: deletedPages.count + deletedRefs.count + deletedProducts.count + deletedEvents.count,
  };
}

export async function getRetentionDays(): Promise<number> {
  const raw = await getSetting(ANALYTICS_DAILY_RETENTION_KEY);
  return Math.max(30, Math.min(730, Number(raw) || ANALYTICS_DAILY_RETENTION_DEFAULT));
}
