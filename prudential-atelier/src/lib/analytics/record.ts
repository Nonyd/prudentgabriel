import { prisma } from "@/lib/prisma";
import { FINANCE_TZ } from "@/lib/finance/aa0";
import { isKnownBot } from "@/lib/analytics/bots";
import { isExcludedPath, normalizePath } from "@/lib/analytics/paths";
import { FUNNEL_ADD_TO_BAG, sanitizeAttribution, type VisitAttribution } from "@/lib/analytics/attribution";

export type AnalyticsEventInput = {
  path?: string;
  productId?: string;
  event?: string;
  landing?: boolean;
  referral?: VisitAttribution | null;
  userAgent?: string | null;
  impersonating?: boolean;
};

function lagosDay(at: Date): Date {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: FINANCE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const num = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return new Date(Date.UTC(num("year"), num("month") - 1, num("day")));
}

export function analyticsDayUtc(at: Date): Date {
  return lagosDay(at);
}

function allowedEventName(name: string): string | null {
  if (name === FUNNEL_ADD_TO_BAG) return name;
  return null;
}

/**
 * Increment aggregate counters. Never stores a visitor id.
 * One upsert per counter - no row per request.
 */
export async function recordAnalyticsEvent(input: AnalyticsEventInput, at = new Date()): Promise<{ recorded: boolean; ms: number }> {
  const started = Date.now();
  if (input.impersonating) return { recorded: false, ms: Date.now() - started };
  if (isKnownBot(input.userAgent)) return { recorded: false, ms: Date.now() - started };

  const day = lagosDay(at);
  const jobs: Promise<unknown>[] = [];

  const path = input.path ? normalizePath(input.path) : "";
  if (path && !isExcludedPath(path)) {
    jobs.push(
      prisma.analyticsPageDaily.upsert({
        where: { day_path: { day, path } },
        create: { day, path, count: 1 },
        update: { count: { increment: 1 } },
      }),
    );
  }

  const productId = typeof input.productId === "string" ? input.productId.trim().slice(0, 40) : "";
  if (productId) {
    jobs.push(
      prisma.analyticsProductDaily.upsert({
        where: { day_productId: { day, productId } },
        create: { day, productId, count: 1 },
        update: { count: { increment: 1 } },
      }),
    );
  }

  const eventName = typeof input.event === "string" ? allowedEventName(input.event) : null;
  if (eventName) {
    jobs.push(
      prisma.analyticsEventDaily.upsert({
        where: { day_name: { day, name: eventName } },
        create: { day, name: eventName, count: 1 },
        update: { count: { increment: 1 } },
      }),
    );
  }

  const referral = input.landing ? sanitizeAttribution(input.referral) : null;
  if (referral && input.landing) {
    const source = referral.source || "(direct)";
    const medium = referral.medium;
    const campaign = referral.campaign;
    const content = referral.content;
    jobs.push(
      prisma.analyticsReferralDaily.upsert({
        where: {
          day_source_medium_campaign_content: { day, source, medium, campaign, content },
        },
        create: { day, source, medium, campaign, content, count: 1 },
        update: { count: { increment: 1 } },
      }),
    );
  }

  if (jobs.length === 0) return { recorded: false, ms: Date.now() - started };
  await Promise.all(jobs);
  return { recorded: true, ms: Date.now() - started };
}
