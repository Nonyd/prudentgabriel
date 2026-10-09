import type { ComponentProps } from "react";
import type { ClientProfile } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { styleProfileComplete } from "@/lib/account-helpers";
import {
  getTierThresholds,
  tierFromPoints,
  pointsToNextTier,
  nextTier,
  tierProgressPercent,
} from "@/lib/loyalty";
import { mapProductToListItem } from "@/lib/map-product-list-item";
import type { AccountDashboard, DashboardState } from "@/components/account/AccountDashboard";
import { canSubmitTestimonial } from "@/lib/testimonial-eligibility";
import { formatBespokeBook } from "@/lib/atelier-fx";
import { liveCompletionStages, clientStageHistory } from "@/lib/atelier/live-stages";
import { isBespokeCommissionActive } from "@/lib/bespoke-archive";
import { getAlterationWarrantyDays } from "@/lib/alterations/policy";
import { ensureTrackingRaw } from "@/lib/capability-token-lookup";

export type AccountDashboardProps = ComponentProps<typeof AccountDashboard>;

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

/**
 * Everything her /account dashboard shows, for one client. Her own page and the
 * admin's "Preview her dashboard" both read it here, so the preview is what she sees.
 *
 * `preview` makes it read-only: no tracking link is minted for an order that has
 * none stored (the live page does that on her first visit), and the link is left out.
 */
export async function loadAccountDashboardProps(params: {
  userId: string;
  profile: ClientProfile;
  preview?: boolean;
}): Promise<AccountDashboardProps> {
  const { userId, profile, preview = false } = params;

  const [user, rtwOrders, consultations, consultationMoodboards, bespokeOrders, measurements, eventDates, orderHistory] =
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
      prisma.consultationBooking.findMany({
        where: {
          userId,
          moodboardImages: { isEmpty: false },
        },
        orderBy: { completedAt: "desc" },
        take: 3,
        select: {
          id: true,
          confirmedDate: true,
          offeringType: true,
          moodboardImages: true,
          moodboardNotes: true,
        },
      }),
      prisma.bespokeOrder.findMany({
        where: { clientProfileId: profile.id },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          stageHistory: { orderBy: { completedAt: "desc" }, take: 1 },
          stageCompletions: { select: { stage: true, revertedAt: true } },
          consultation: { select: { bookingNumber: true } },
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

  const warrantyDays = await getAlterationWarrantyDays();
  const activeBespokeList = bespokeOrders.filter((o) =>
    isBespokeCommissionActive({
      status: o.status,
      receiptConfirmedAt: o.receiptConfirmedAt,
      warrantyDays,
    }),
  );
  const bespokeActiveCount = activeBespokeList.length;

  const rtwActiveCount = await prisma.order.count({
    where: { userId, status: { not: "DELIVERED" }, isBespoke: false },
  });

  const activeBespokeRaw = activeBespokeList[0];
  const activeBespoke = activeBespokeRaw
    ? {
        ...activeBespokeRaw,
        trackingToken: preview ? "" : await ensureTrackingRaw(activeBespokeRaw),
        stageHistory: clientStageHistory(
          activeBespokeRaw.stageHistory,
          liveCompletionStages(activeBespokeRaw.stageCompletions),
        ),
      }
    : undefined;
  const outstandingOrders = await prisma.bespokeOrder.findMany({
    where: {
      clientProfileId: profile.id,
      currentStage: { not: "DELIVERY" },
      balance: { gt: 0 },
    },
    select: {
      balance: true,
      currency: true,
      fxRateLocked: true,
      fxGbpRateLocked: true,
      fxRateSource: true,
      fxRateFetchedAt: true,
      fxRateStale: true,
    },
    take: 8,
  });
  const balanceDue = outstandingOrders.reduce((sum, o) => sum + o.balance, 0);
  const balanceDueLabel =
    outstandingOrders.length === 0
      ? null
      : outstandingOrders.length === 1
        ? formatBespokeBook(outstandingOrders[0]!.balance, outstandingOrders[0]!)
        : `${outstandingOrders.length} commissions`;

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

  const testimonialEligibility = await canSubmitTestimonial(userId);
  let testimonialCard: "write" | "pending" | null = null;
  if (testimonialEligibility.eligible) {
    if (testimonialEligibility.hasExistingTestimonial) {
      if (testimonialEligibility.pendingTestimonial) testimonialCard = "pending";
    } else {
      testimonialCard = "write";
    }
  }

  return {
    firstName,
    today,
    tier,
    points,
    toNext,
    nextTier: next,
    progressPct,
    rtwActiveCount,
    bespokeActiveCount,
    balanceDue,
    balanceDueLabel,
    memberSince,
    dashboardState,
    styleProfileComplete: styleProfileComplete(profile),
    stylePreferences: {
      silhouettes: profile.preferredSilhouettes.slice(0, 4),
      colors: profile.preferredColors.slice(0, 4),
      occasions: profile.occasions.slice(0, 4),
    },
    rtwOrders,
    activeBespoke,
    upcomingConsultation: upcomingConsultation ?? null,
    consultations,
    consultationMoodboards,
    measurements,
    eventDates,
    personalizedPicks: personalizedPicks.map(mapProductToListItem),
    testimonialCard,
  };
}
