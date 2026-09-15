/**
 * Slice AT: first-party aggregate analytics. No visitor identifiers.
 *
 *   pnpm test:slice-at
 */
import "./preload-test-env";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  OrderStatus,
  PaymentStatus,
  ProductCategory,
  ProductType,
  Role,
} from "@prisma/client";
import { COOKIE_BANNER_NOTICE } from "../src/lib/cookie-consent";
import {
  ATTRIBUTION_STORAGE_KEY,
  captureAttribution,
  FUNNEL_ADD_TO_BAG,
  GLORY_UTM_NOTE,
  parseUtmSearch,
  referrerHost,
  sanitizeAttribution,
} from "../src/lib/analytics/attribution";
import { isKnownBot } from "../src/lib/analytics/bots";
import { isExcludedPath, normalizePath } from "../src/lib/analytics/paths";
import { recordAnalyticsEvent } from "../src/lib/analytics/record";
import { buildHouseNumbers } from "../src/lib/analytics/query";
import { rollupAnalyticsDaily } from "../src/lib/analytics/retention";
import { customRange } from "../src/lib/finance/period";
import { prisma } from "../src/lib/prisma";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = (rel: string) => readFileSync(join(root, rel), "utf8");
const stamp = `at-${Date.now()}`;
const sept = new Date("2026-09-14T10:00:00+01:00");

function runPure() {
  assert(
    COOKIE_BANNER_NOTICE ===
      "This site uses cookies to keep you signed in, hold your bag and remember your currency. Nothing else.",
    "cookie banner sentence is unchanged",
  );
  const cookieMd = src("src/lib/legal-copy.ts");
  assert(cookieMd.includes("There is no Reject Non-Essential"), "cookie policy still has no analytics toggle");
  assert(cookieMd.includes("does not load Google Analytics, Meta Pixel"), "cookie policy still names no third-party trackers");

  const recordSrc = src("src/lib/analytics/record.ts");
  assert(!/visitorId|clientId|anonymousId|distinct_id|hashedIp|salt/i.test(recordSrc), "record layer has no visitor id");
  const schema = src("prisma/schema.prisma");
  assert(schema.includes("model AnalyticsPageDaily"), "page counts are aggregated by day");
  assert(!/visitorId|clientId|anonymousId/.test(schema.slice(schema.indexOf("model AnalyticsPageDaily"))), "analytics models have no visitor id");
  assert(src("src/components/analytics/PageBeacon.tsx").includes("sendBeacon"), "page recording is fire-and-forget");
  assert(src("src/lib/analytics/attribution.ts").includes("sessionStorage"), "UTMs are held in sessionStorage, not a cookie");
  assert(src("src/components/analytics/PageBeacon.tsx").includes("captureAndHoldFromWindow"), "beacon holds first-touch tags for the visit");
  assert(!src("src/components/analytics/PageBeacon.tsx").includes("cookies.set"), "beacon does not set a cookie");
  assert(src("src/app/(storefront)/layout.tsx").includes("PageBeacon"), "storefront layout records public pages");
  assert(!src("src/app/(admin)/layout.tsx").includes("PageBeacon"), "admin layout does not record");
  assert(src("src/components/admin/finance/HowWeAreDoingClient.tsx").includes("HouseNumbersPanel"), "numbers live on How we are doing");
  assert(src("src/components/admin/finance/HouseNumbersPanel.tsx").includes("glass-opaque"), "data sits on solid panels");
  assert(!src("src/components/admin/finance/HouseNumbersPanel.tsx").includes("googletagmanager"), "no tag manager on the report");
  assert(GLORY_UTM_NOTE.includes("utm_source=instagram"), "Glory has a tagged-link example");
  assert(ATTRIBUTION_STORAGE_KEY === "pa-visit-attribution", "visit hold is named and is not a cookie");

  assert(isExcludedPath("/admin/reports"), "admin is excluded");
  assert(isExcludedPath("/staff/pipeline"), "staff is excluded");
  assert(isExcludedPath("/track/abc"), "token track is excluded");
  assert(isExcludedPath("/quote/abc"), "token quote is excluded");
  assert(isExcludedPath("/approve/abc"), "token approve is excluded");
  assert(isExcludedPath("/invoice/abc"), "token invoice is excluded");
  assert(isExcludedPath("/receipt/abc"), "token receipt is excluded");
  assert(isExcludedPath("/checkout/restore/tok"), "restore token is excluded");
  assert(isExcludedPath("/unsubscribe"), "unsubscribe is excluded");
  assert(isExcludedPath("/api/analytics/event"), "api routes are excluded");
  assert(!isExcludedPath("/rtw"), "rtw aisle is recorded");
  assert(!isExcludedPath("/shop/avril"), "product pages are recorded");
  assert(normalizePath("/rtw/?utm_source=x") === "/rtw", "query string is stripped before counting");

  assert(isKnownBot("Googlebot/2.1"), "googlebot is skipped");
  assert(isKnownBot("curl/8.0"), "curl is skipped");
  assert(isKnownBot(""), "empty UA is skipped");
  assert(!isKnownBot("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"), "a phone is not a bot");

  const utm = parseUtmSearch("?utm_source=instagram&utm_medium=social&utm_campaign=spring&utm_content=story-1");
  assert(utm.source === "instagram" && utm.campaign === "spring", "UTM parse");
  assert(referrerHost("https://l.instagram.com/p/x", "staging.prudentgabriel.com") === "l.instagram.com", "referrer host only");
  assert(referrerHost("https://staging.prudentgabriel.com/rtw", "staging.prudentgabriel.com") === "", "same-host referrer is not a source");

  const first = captureAttribution({
    search: "?utm_source=instagram&utm_campaign=spring",
    pathname: "/rtw",
    referrer: "https://l.instagram.com/",
    ownHost: "staging.prudentgabriel.com",
  });
  assert(first.freshLanding && first.attribution.source === "instagram", "first landing captures UTMs");
  const second = captureAttribution({
    search: "",
    pathname: "/shop/avril",
    referrer: "",
    ownHost: "staging.prudentgabriel.com",
    existing: first.attribution,
  });
  assert(!second.freshLanding && second.attribution.campaign === "spring", "later pages keep first-touch tags");
  assert(sanitizeAttribution({ source: "instagram", campaign: "spring" })?.source === "instagram", "attribution sanitizes");
  assert(FUNNEL_ADD_TO_BAG === "add_to_bag", "add-to-bag is a named aggregate event");
}

async function runDb() {
  const user = await prisma.user.create({
    data: { email: `${stamp}@sliceat.test`, name: "Slice AT", role: Role.CUSTOMER },
  });
  const product = await prisma.product.create({
    data: {
      name: `AT Dress ${stamp}`,
      slug: `at-dress-${stamp}`,
      description: "test",
      category: ProductCategory.FORMAL,
      type: ProductType.RTW,
      priceNGN: 210_000,
      basePriceNGN: 210_000,
      isPublished: true,
    },
  });
  const looked = await prisma.product.create({
    data: {
      name: `AT Looked ${stamp}`,
      slug: `at-looked-${stamp}`,
      description: "test",
      category: ProductCategory.FORMAL,
      type: ProductType.RTW,
      priceNGN: 90_000,
      basePriceNGN: 90_000,
      isPublished: true,
    },
  });

  const skipped = await recordAnalyticsEvent(
    { path: "/admin/reports", userAgent: "Mozilla/5.0" },
    sept,
  );
  assert(!skipped.recorded, "admin path is not written");
  const bot = await recordAnalyticsEvent({ path: "/rtw", userAgent: "Googlebot" }, sept);
  assert(!bot.recorded, "bot is not written");
  const staff = await recordAnalyticsEvent(
    { path: "/rtw", userAgent: "Mozilla/5.0", impersonating: true },
    sept,
  );
  assert(!staff.recorded, "impersonating staff is not written");

  const t0 = Date.now();
  const page = await recordAnalyticsEvent(
    {
      path: "/rtw",
      userAgent: "Mozilla/5.0",
      landing: true,
      referral: {
        source: "instagram",
        medium: "social",
        campaign: "spring",
        content: "story-1",
        referrer: "l.instagram.com",
        landingPath: "/rtw",
      },
    },
    sept,
  );
  await recordAnalyticsEvent({ path: "/rtw", userAgent: "Mozilla/5.0" }, sept);
  await recordAnalyticsEvent({ productId: product.id, userAgent: "Mozilla/5.0" }, sept);
  await recordAnalyticsEvent({ productId: looked.id, userAgent: "Mozilla/5.0" }, sept);
  await recordAnalyticsEvent({ event: FUNNEL_ADD_TO_BAG, userAgent: "Mozilla/5.0" }, sept);
  const elapsed = Date.now() - t0;
  assert(page.recorded, "public aisle is counted");
  assert(typeof page.ms === "number" && page.ms >= 0, `record reports duration (${page.ms}ms)`);
  assert(elapsed < 15000, `batch of writes stayed under 15s on this Neon hop, was ${elapsed}ms`);

  const checkout = await prisma.checkoutSession.create({
    data: {
      email: `${stamp}@sliceat.test`,
      cartSnapshot: { lines: [], subtotalNGN: 210_000 },
      createdAt: sept,
      attribution: {
        source: "instagram",
        medium: "social",
        campaign: "spring",
        content: "story-1",
        referrer: "l.instagram.com",
        landingPath: "/rtw",
      },
    },
  });

  const order = await prisma.order.create({
    data: {
      orderNumber: `AT-RTW-${stamp}`,
      userId: user.id,
      subtotal: 210_000,
      total: 210_000,
      paymentStatus: PaymentStatus.PAID,
      status: OrderStatus.CONFIRMED,
      paidAt: sept,
      createdAt: sept,
      attribution: {
        source: "instagram",
        medium: "social",
        campaign: "spring",
        content: "story-1",
        referrer: "l.instagram.com",
        landingPath: "/rtw",
      },
      items: {
        create: {
          productId: product.id,
          quantity: 1,
          size: "12",
          price: 210_000,
          lineTotal: 210_000,
        },
      },
    },
  });

  const offering = await ensureOffering();
  const booking = await prisma.consultationBooking.create({
    data: {
      bookingNumber: `AT-BK-${stamp}`,
      offeringId: offering.id,
      consultantId: offering.consultantId,
      clientName: "Glory",
      clientEmail: `glory+${stamp}@sliceat.test`,
      clientPhone: "+2348000000099",
      clientCountry: "NG",
      occasion: "Wedding",
      description: "Slice AT consultation booking for attribution.",
      feeNGN: 25_000,
      createdAt: sept,
      attribution: { source: "instagram", campaign: "spring", medium: "social", content: "", referrer: "", landingPath: "/consultation" },
    },
  });

  const range = customRange("2026-09-01", "2026-09-30");
  const house = await buildHouseNumbers(range.from, range.to, range.from, range.to, 210_000, 0);
  const paidStep = house.rtwFunnel.find((s) => s.id === "paid");
  const allPaid = await prisma.order.count({
    where: { paidAt: { gte: range.from, lt: range.to }, paymentStatus: PaymentStatus.PAID },
  });
  assert(paidStep?.count === allPaid, `paid funnel ${paidStep?.count} must match paid orders ${allPaid}`);
  assert(house.rtwFunnel.find((s) => s.id === "aisle")!.count >= 2, "aisle views were aggregated, not stored per request");
  assert(house.rtwFunnel.find((s) => s.id === "bag")!.count >= 1, "add to bag is a count");
  const ig = house.traffic.find((t) => t.source === "instagram" && t.campaign === "spring");
  assert(ig && ig.orders >= 1, "Instagram campaign is attributed on the order");
  assert(house.lookedNotBought.some((r) => r.productId === looked.id), "looked-at-not-bought lists the unsold piece");
  const stored = await prisma.order.findUnique({ where: { id: order.id }, select: { attribution: true } });
  const attr = stored?.attribution as { source?: string };
  assert(attr?.source === "instagram", "UTMs landed on the order");
  const booked = await prisma.consultationBooking.findUnique({ where: { id: booking.id }, select: { attribution: true } });
  assert((booked?.attribution as { source?: string })?.source === "instagram", "UTMs landed on the consultation");

  const pageRow = await prisma.analyticsPageDaily.findFirst({
    where: { path: "/rtw", day: { gte: range.from, lte: new Date("2026-09-14T00:00:00.000Z") } },
  });
  assert(pageRow && pageRow.count >= 2, "two /rtw views share one daily row");
  const keys = Object.keys(pageRow ?? {});
  assert(!keys.some((k) => /visitor|client|ip|userAgent|hash/i.test(k)), "daily row has no visitor field");

  const oldDay = new Date(Date.UTC(2025, 0, 5));
  await prisma.analyticsPageDaily.create({
    data: { day: oldDay, path: `/at-old-${stamp}`, count: 4 },
  });
  const rolled = await rollupAnalyticsDaily(sept);
  assert(rolled.deleted >= 1, "old daily rows roll into monthly totals");
  const monthly = await prisma.analyticsPageMonthly.findFirst({ where: { path: `/at-old-${stamp}` } });
  assert(monthly?.count === 4, "monthly total keeps the count after daily detail expires");
  const leftover = await prisma.analyticsPageDaily.findFirst({ where: { path: `/at-old-${stamp}` } });
  assert(!leftover, "rolled daily row is gone");

  await prisma.consultationBooking.delete({ where: { id: booking.id } }).catch(() => undefined);
  await prisma.checkoutSession.delete({ where: { id: checkout.id } }).catch(() => undefined);
  await prisma.order.delete({ where: { id: order.id } }).catch(() => undefined);
  await prisma.analyticsProductDaily.deleteMany({ where: { productId: { in: [product.id, looked.id] } } });
  await prisma.product.deleteMany({ where: { id: { in: [product.id, looked.id] } } });
  await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
  await prisma.analyticsPageMonthly.deleteMany({ where: { path: `/at-old-${stamp}` } });
}

let offeringCache: { id: string; consultantId: string } | null = null;
async function ensureOffering(): Promise<{ id: string; consultantId: string }> {
  if (offeringCache) return offeringCache;
  const existing = await prisma.consultantOffering.findFirst({
    where: { isActive: true },
    select: { id: true, consultantId: true },
  });
  if (existing) {
    offeringCache = existing;
    return existing;
  }
  const consultant = await prisma.consultant.create({
    data: {
      name: `AT Consultant ${stamp}`,
      title: "Stylist",
      bio: "Test consultant for slice AT.",
      isActive: true,
    },
  });
  const offering = await prisma.consultantOffering.create({
    data: {
      consultantId: consultant.id,
      sessionType: "STYLING_SESSION",
      deliveryMode: "VIRTUAL_STANDARD",
      durationMinutes: 45,
      feeNGN: 25_000,
      isActive: true,
    },
  });
  offeringCache = { id: offering.id, consultantId: consultant.id };
  return offeringCache;
}

async function main() {
  runPure();
  try {
    await runDb();
  } finally {
    await prisma.$disconnect();
  }
  console.log("test-slice-at: ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
