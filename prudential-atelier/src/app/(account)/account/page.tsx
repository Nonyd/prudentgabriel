import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateClientProfile, styleProfileComplete } from "@/lib/account-helpers";
import {
  getTierThresholds,
  tierFromPoints,
  pointsToNextTier,
  nextTier,
  tierProgressPercent,
} from "@/lib/loyalty";
import { mapProductToListItem } from "@/lib/map-product-list-item";
import { AccountDashboard } from "@/components/account/AccountDashboard";
import type { DashboardState } from "@/components/account/AccountDashboard";

const BUDGET_RANGES: Record<string, [number, number]> = {
  "₦50k–₦150k": [50000, 150000],
  "₦150k–₦350k": [150000, 350000],
  "₦350k–₦750k": [350000, 750000],
  "₦750k+": [750000, 999_999_999],
};

function resolveDashboardState(input: {
  activeBespoke: boolean;
  bespokeActiveCount: number;
  rtwActiveCount: number;
  hasOrderHistory: boolean;
  upcomingConsultation: boolean;
}): DashboardState {
  if (input.activeBespoke || input.bespokeActiveCount > 0 || input.rtwActiveCount > 0) {
    return "has_active_order";
  }
  if (input.upcomingConsultation) {
    return "has_consultation";
  }
  if (input.hasOrderHistory) {
    return "returning_client";
  }
  return "new_client";
}

export default async function AccountDashboardPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const profile = await getOrCreateClientProfile(userId);

  const [user, rtwOrders, consultations, bespokeOrders, measurements, eventDates, orderHistory] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, pointsBalance: true, createdAt: true },
      }),
      prisma.order.findMany({
        where: { userId, isBespoke: false },
        orderBy: { createdAt: "desc" },
        take: 3,
        include: {
          items: {
            take: 1,
            include: {
              product: {
                select: {
                  name: true,
                  images: { where: { isPrimary: true }, take: 1 },
                },
              },
            },
          },
        },
      }),
      prisma.consultationBooking.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          consultant: { select: { name: true } },
          offering: { select: { sessionType: true, deliveryMode: true } },
        },
      }),
      prisma.bespokeOrder.findMany({
        where: { clientProfileId: profile.id },
        orderBy: { createdAt: "desc" },
        take: 3,
        include: {
          stageHistory: { orderBy: { completedAt: "desc" }, take: 1 },
        },
      }),
      prisma.measurement.findUnique({ where: { clientId: profile.id } }),
      prisma.eventDate.findMany({
        where: { clientId: profile.id, date: { gte: new Date() } },
        orderBy: { date: "asc" },
        take: 3,
      }),
      Promise.all([
        prisma.order.count({ where: { userId, isBespoke: false } }),
        prisma.bespokeOrder.count({ where: { clientProfileId: profile.id } }),
      ]),
    ]);

  const [rtwOrderCount, bespokeOrderCount] = orderHistory;
  const hasOrderHistory = rtwOrderCount > 0 || bespokeOrderCount > 0;

  const thresholds = await getTierThresholds();
  const points = user?.pointsBalance ?? 0;
  const tier = tierFromPoints(points, thresholds);
  const next = nextTier(tier);
  const toNext = pointsToNextTier(points, tier, thresholds);
  const progressPct = tierProgressPercent(points, tier, thresholds);
  const firstName = (user?.name ?? "there").split(/\s+/)[0] ?? "there";
  const memberSince = user?.createdAt ?? new Date();

  const [rtwActiveCount, bespokeActiveCount] = await Promise.all([
    prisma.order.count({
      where: { userId, status: { not: "DELIVERED" }, isBespoke: false },
    }),
    prisma.bespokeOrder.count({
      where: { clientProfileId: profile.id, currentStage: { not: "DELIVERY" } },
    }),
  ]);

  const activeBespoke = bespokeOrders.find((o) => o.currentStage !== "DELIVERY");
  const outstandingBalance = await prisma.bespokeOrder.aggregate({
    where: {
      clientProfileId: profile.id,
      currentStage: { not: "DELIVERY" },
      balance: { gt: 0 },
    },
    _sum: { balance: true },
  });
  const balanceDue = outstandingBalance._sum.balance ?? 0;

  const now = new Date();
  const upcomingConsultation = consultations.find((c) => {
    if (c.status.startsWith("CANCELLED") || c.status === "COMPLETED" || c.status === "NO_SHOW") {
      return false;
    }
    const when = c.confirmedDate ?? c.preferredDate1;
    return when ? when >= now : c.status === "PENDING_CONFIRMATION" || c.status === "CONFIRMED";
  });

  const dashboardState = resolveDashboardState({
    activeBespoke: Boolean(activeBespoke),
    bespokeActiveCount,
    rtwActiveCount,
    hasOrderHistory,
    upcomingConsultation: Boolean(upcomingConsultation),
  });

  let personalizedPicks = await prisma.product.findMany({
    where: { isPublished: true },
    take: 4,
    orderBy: [{ isFeatured: "desc" }, { orderCount: "desc" }],
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      variants: { orderBy: { sortOrder: "asc" } },
      colors: true,
      _count: { select: { reviews: true } },
    },
  });

  if (styleProfileComplete(profile) && profile.budgetRange && BUDGET_RANGES[profile.budgetRange]) {
    const [min, max] = BUDGET_RANGES[profile.budgetRange]!;
    const filtered = await prisma.product.findMany({
      where: {
        isPublished: true,
        priceNGN: { gte: min, lte: max },
        ...(profile.preferredColors.length
          ? { tags: { hasSome: profile.preferredColors.map((c) => c.toLowerCase()) } }
          : {}),
      },
      take: 4,
      orderBy: [{ isFeatured: "desc" }, { orderCount: "desc" }],
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        variants: { orderBy: { sortOrder: "asc" } },
        colors: true,
        _count: { select: { reviews: true } },
      },
    });
    if (filtered.length) personalizedPicks = filtered;
  }

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <AccountDashboard
      firstName={firstName}
      today={today}
      tier={tier}
      points={points}
      toNext={toNext}
      nextTier={next}
      progressPct={progressPct}
      rtwActiveCount={rtwActiveCount}
      bespokeActiveCount={bespokeActiveCount}
      balanceDue={balanceDue}
      memberSince={memberSince}
      dashboardState={dashboardState}
      styleProfileComplete={styleProfileComplete(profile)}
      stylePreferences={{
        silhouettes: profile.preferredSilhouettes.slice(0, 4),
        colors: profile.preferredColors.slice(0, 4),
        occasions: profile.occasions.slice(0, 4),
      }}
      rtwOrders={rtwOrders}
      activeBespoke={activeBespoke}
      upcomingConsultation={upcomingConsultation ?? null}
      consultations={consultations}
      measurements={measurements}
      eventDates={eventDates}
      personalizedPicks={personalizedPicks.map(mapProductToListItem)}
    />
  );
}
