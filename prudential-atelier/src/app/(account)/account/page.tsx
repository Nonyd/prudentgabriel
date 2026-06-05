import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateClientProfile } from "@/lib/account-helpers";
import {
  getTierThresholds,
  tierFromPoints,
  pointsToNextTier,
  nextTier,
} from "@/lib/loyalty";
import { AccountDashboard } from "@/components/account/AccountDashboard";

export default async function AccountDashboardPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const profile = await getOrCreateClientProfile(userId);

  const [user, rtwOrders, consultations, bespokeOrders, measurements, eventDates] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, pointsBalance: true },
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
        take: 2,
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
    ]);

  const thresholds = await getTierThresholds();
  const points = user?.pointsBalance ?? 0;
  const tier = tierFromPoints(points, thresholds);
  const next = nextTier(tier);
  const toNext = pointsToNextTier(points, tier, thresholds);
  const firstName = (user?.name ?? "there").split(/\s+/)[0] ?? "there";

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
      rtwActiveCount={rtwActiveCount}
      bespokeActiveCount={bespokeActiveCount}
      totalSpend={profile.totalSpend}
      balanceDue={balanceDue}
      rtwOrders={rtwOrders}
      activeBespoke={activeBespoke}
      consultations={consultations}
      measurements={measurements}
      eventDates={eventDates}
    />
  );
}
