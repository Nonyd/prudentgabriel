import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { FINANCE_TZ } from "@/lib/finance/aa0";
import { isKnownBot } from "@/lib/analytics/bots";
import { isExcludedPath, normalizePath } from "@/lib/analytics/paths";
import { FUNNEL_ADD_TO_BAG, sanitizeAttribution, type VisitAttribution } from "@/lib/analytics/attribution";
import { uaBuckets } from "@/lib/analytics/ua";
import { GAP_BUCKETS, SCREEN_BUCKETS, type VisitorDay } from "@/lib/analytics/visitor";

export const FUNNEL_NOT_FOUND = "not_found";
/** Longest single stretch on one page we believe. Longer is a tab left open. */
export const DWELL_CAP_SECONDS = 30 * 60;

export type AnalyticsEventInput = {
  path?: string;
  productId?: string;
  event?: string;
  landing?: boolean;
  referral?: VisitAttribution | null;
  userAgent?: string | null;
  impersonating?: boolean;
  /** First page of the day in this browser (see lib/analytics/visitor). */
  visitor?: VisitorDay | null;
  /** This visit just became engaged (second page, or 10 s on one). */
  engaged?: boolean;
  /** Visible seconds on a page. A view may report in pieces; `first` marks its first piece. */
  dwell?: { path: string; s: number; first?: boolean } | null;
  /** For not_found: the address that had no page. */
  missing?: string;
  /** ISO country from Cloudflare; empty when unknown. Never the IP. */
  country?: string;
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

function lagosHour(at: Date): string {
  const h = new Intl.DateTimeFormat("en-GB", { timeZone: FINANCE_TZ, hour: "2-digit", hour12: false }).format(at);
  return String(Number(h) % 24).padStart(2, "0");
}

function allowedEventName(name: string): string | null {
  if (name === FUNNEL_ADD_TO_BAG || name === FUNNEL_NOT_FOUND) return name;
  return null;
}

type DimTick = { dim: string; key: string; n: number };

/** One statement for every dimension counter this request touches. */
async function bumpDims(day: Date, ticks: DimTick[]) {
  if (ticks.length === 0) return;
  const merged = new Map<string, DimTick>();
  for (const t of ticks) {
    const k = `${t.dim}\u0000${t.key}`;
    const prev = merged.get(k);
    if (prev) prev.n += t.n;
    else merged.set(k, { ...t });
  }
  const rows = Array.from(merged.values()).map(
    (t) => Prisma.sql`(gen_random_uuid()::text, ${day}::date, ${t.dim}, ${t.key.slice(0, 200)}, ${t.n})`,
  );
  await prisma.$executeRaw`
    INSERT INTO "AnalyticsDimDaily" ("id", "day", "dim", "key", "count")
    VALUES ${Prisma.join(rows)}
    ON CONFLICT ("day", "dim", "key") DO UPDATE SET "count" = "AnalyticsDimDaily"."count" + EXCLUDED."count"`;
}

async function bumpMinute(at: Date) {
  const minute = new Date(Math.floor(at.getTime() / 60_000) * 60_000);
  await prisma.$executeRaw`
    INSERT INTO "AnalyticsMinute" ("minute", "count") VALUES (${minute}, 1)
    ON CONFLICT ("minute") DO UPDATE SET "count" = "AnalyticsMinute"."count" + 1`;
}

/**
 * Increment aggregate counters. Never stores a visitor id.
 * One upsert per counter - no row per request.
 */
export async function recordAnalyticsEvent(input: AnalyticsEventInput, at = new Date()): Promise<{ recorded: boolean; ms: number }> {
  const started = Date.now();
  if (input.impersonating) return { recorded: false, ms: Date.now() - started };

  const day = lagosDay(at);
  if (isKnownBot(input.userAgent)) {
    // Counted so the traffic page can say how much automated traffic was kept out.
    await bumpDims(day, [{ dim: "m", key: "bots", n: 1 }]);
    return { recorded: false, ms: Date.now() - started };
  }

  const jobs: Promise<unknown>[] = [];
  const ticks: DimTick[] = [];

  const path = input.path ? normalizePath(input.path) : "";
  if (path && !isExcludedPath(path)) {
    jobs.push(
      prisma.analyticsPageDaily.upsert({
        where: { day_path: { day, path } },
        create: { day, path, count: 1 },
        update: { count: { increment: 1 } },
      }),
    );
    ticks.push({ dim: "hour", key: lagosHour(at), n: 1 });
    jobs.push(bumpMinute(at));
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
  if (eventName === FUNNEL_NOT_FOUND) {
    const missing = typeof input.missing === "string" ? normalizePath(input.missing) : "";
    if (missing && !isExcludedPath(missing)) ticks.push({ dim: "404", key: missing, n: 1 });
  } else if (eventName) {
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
    ticks.push({ dim: "m", key: "sessions", n: 1 });
    const landing = normalizePath(referral.landingPath || path || "/");
    if (!isExcludedPath(landing)) ticks.push({ dim: "landing", key: landing, n: 1 });
  }

  const visitor = input.visitor;
  if (visitor && (visitor.kind === "new" || visitor.kind === "returning")) {
    const ua = uaBuckets(input.userAgent);
    ticks.push(
      { dim: "m", key: "visitors", n: 1 },
      { dim: "visitor", key: visitor.kind, n: 1 },
      { dim: "country", key: input.country || "unknown", n: 1 },
      { dim: "device", key: ua.device, n: 1 },
      { dim: "browser", key: ua.browser, n: 1 },
      { dim: "os", key: ua.os, n: 1 },
    );
    if ((GAP_BUCKETS as readonly string[]).includes(visitor.gap)) ticks.push({ dim: "gap", key: visitor.gap, n: 1 });
    if ((SCREEN_BUCKETS as readonly string[]).includes(visitor.screen)) {
      ticks.push({ dim: "screen", key: visitor.screen, n: 1 });
    }
  }

  if (input.engaged) ticks.push({ dim: "m", key: "engaged", n: 1 });

  if (input.dwell) {
    const dwellPath = normalizePath(input.dwell.path);
    const seconds = Math.round(Math.min(DWELL_CAP_SECONDS, Math.max(0, Number(input.dwell.s) || 0)));
    if (seconds >= 1 && !isExcludedPath(dwellPath)) {
      ticks.push({ dim: "dwell_s", key: dwellPath, n: seconds }, { dim: "m", key: "dwell_s", n: seconds });
      if (input.dwell.first) ticks.push({ dim: "dwell_n", key: dwellPath, n: 1 }, { dim: "m", key: "dwell_n", n: 1 });
    }
  }

  if (ticks.length > 0) jobs.push(bumpDims(day, ticks));

  if (jobs.length === 0) return { recorded: false, ms: Date.now() - started };
  await Promise.all(jobs);
  return { recorded: true, ms: Date.now() - started };
}
