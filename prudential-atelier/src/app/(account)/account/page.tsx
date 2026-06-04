import Link from "next/link";
import Image from "next/image";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateClientProfile } from "@/lib/account-helpers";
import {
  getTierThresholds,
  tierFromPoints,
  pointsToNextTier,
  nextTier,
  TIER_LABELS,
  TIER_BENEFITS,
} from "@/lib/loyalty";
import { BespokeStageTracker } from "@/components/bespoke/BespokeStageTracker";
import { STAGE_SHORT_LABELS } from "@/lib/bespoke-stages";
import { formatDate, formatPrice } from "@/lib/utils";

export default async function AccountDashboardPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const profile = await getOrCreateClientProfile(userId);

  const [user, rtwOrders, consultations, bespokeOrders, measurements, moodboards, eventDates] =
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
      prisma.moodboard.findMany({
        where: { clientId: profile.id },
        take: 4,
      }),
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
  const lastStage = activeBespoke?.stageHistory[0];

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] text-choc">Welcome back, {firstName}</h1>
          <p className="mt-1 font-sans text-xs font-light text-text-light">{today}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1 rounded-sm border border-lightbr/40 px-2 py-1 font-sans text-[10px] uppercase tracking-wider text-lightbr">
              {TIER_LABELS[tier]}
            </span>
            <span className="font-display text-[22px] text-lightbr">{points.toLocaleString()} points</span>
          </div>
        </div>
        <Link
          href="/consultation"
          className="inline-flex bg-nut px-6 py-3 font-sans text-[10px] font-semibold uppercase tracking-wider text-cream"
        >
          Book Consultation
        </Link>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active Orders" value={String(rtwActiveCount + bespokeActiveCount)} />
        <StatCard label="Total Spent" value={formatPrice(profile.totalSpend, "NGN")} />
        <StatCard label="Loyalty Points" value={points.toLocaleString()} sub={next ? `${toNext} to ${TIER_LABELS[next]}` : "Top tier"} />
        <StatCard
          label="Outstanding Balance"
          value={balanceDue > 0 ? formatPrice(balanceDue, "NGN") : "—"}
          highlight={balanceDue > 0}
          href={balanceDue > 0 ? "/account/orders" : undefined}
          hrefLabel={balanceDue > 0 ? "Pay Now" : undefined}
        />
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-8">
          {activeBespoke ? (
            <section className="card-surface p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-lightbr">
                    Active Bespoke Order
                  </p>
                  <h2 className="mt-1 font-display text-xl text-choc">{activeBespoke.orderRef}</h2>
                  {activeBespoke.outfitDescription ? (
                    <p className="mt-1 line-clamp-2 font-sans text-sm text-text-mid">
                      {activeBespoke.outfitDescription}
                    </p>
                  ) : null}
                  {activeBespoke.deliveryDate ? (
                    <p className="mt-2 font-sans text-xs text-nut">
                      Delivery: {formatDate(activeBespoke.deliveryDate)}
                    </p>
                  ) : null}
                </div>
                <span className="rounded-sm bg-nut/10 px-2 py-1 font-sans text-[10px] uppercase text-nut">
                  {STAGE_SHORT_LABELS[activeBespoke.currentStage]}
                </span>
              </div>
              {lastStage?.notes ? (
                <p className="mt-4 font-sans text-sm text-text-mid">{lastStage.notes}</p>
              ) : null}
              <BespokeStageTracker
                currentStage={activeBespoke.currentStage}
                stageHistory={activeBespoke.stageHistory}
                compact
              />
              <div className="mt-4 flex flex-wrap gap-4">
                <Link
                  href={`/track/${activeBespoke.trackingToken}`}
                  target="_blank"
                  className="font-sans text-xs text-nut underline"
                >
                  Track publicly
                </Link>
                <Link href="/account/orders" className="font-sans text-xs text-text-mid underline">
                  View all bespoke orders
                </Link>
              </div>
            </section>
          ) : null}

          <section className="card-surface p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl text-choc">Recent RTW Orders</h2>
              <Link href="/account/orders" className="font-sans text-xs text-nut">
                View all orders
              </Link>
            </div>
            {rtwOrders.length === 0 ? (
              <div className="py-8 text-center">
                <p className="font-sans text-sm text-text-mid">No orders yet — browse the shop</p>
                <Link href="/shop" className="btn-primary mt-4 inline-flex">
                  Shop now
                </Link>
              </div>
            ) : (
              <ul className="space-y-3">
                {rtwOrders.map((o) => {
                  const item = o.items[0];
                  const img = item?.product.images[0]?.url;
                  return (
                    <li
                      key={o.id}
                      className="flex items-center gap-4 border border-sand/60 p-3"
                    >
                      <div className="relative h-14 w-14 shrink-0 bg-bg">
                        {img ? (
                          <Image src={img} alt="" fill className="object-cover" unoptimized />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-sans text-sm text-choc">
                          {item?.product.name ?? "Order"}
                        </p>
                        <p className="font-sans text-xs text-text-light">
                          {formatDate(o.createdAt)} · {item?.size}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-sans text-sm text-choc">{formatPrice(o.total, "NGN")}</p>
                        <span className="font-sans text-[10px] uppercase text-lightbr">{o.status}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-lg bg-choc p-6 text-cream">
            <p className="font-sans text-[10px] uppercase tracking-[0.16em] text-lightbr">Loyalty</p>
            <p className="mt-2 font-display text-4xl">{points.toLocaleString()}</p>
            <p className="font-sans text-sm text-cream/80">{TIER_LABELS[tier]} member</p>
            {next ? (
              <div className="mt-4">
                <div className="h-1.5 overflow-hidden rounded-full bg-cream/20">
                  <div
                    className="h-full bg-lightbr"
                    style={{
                      width: `${Math.min(100, Math.round((points / (points + toNext)) * 100))}%`,
                    }}
                  />
                </div>
                <p className="mt-2 font-sans text-xs text-cream/70">
                  {toNext} points to {TIER_LABELS[next]}
                </p>
              </div>
            ) : null}
            <ul className="mt-4 space-y-2">
              {TIER_BENEFITS.map((b) => {
                const unlocked = b.tiers.includes(tier);
                return (
                  <li key={b.label} className="flex items-center gap-2 font-sans text-xs">
                    <span>{unlocked ? "✓" : "🔒"}</span>
                    <span className={unlocked ? "text-cream" : "text-cream/50"}>{b.label}</span>
                  </li>
                );
              })}
            </ul>
            <Link href="/account/loyalty" className="mt-4 inline-block font-sans text-xs text-lightbr underline">
              View rewards
            </Link>
          </section>

          <section className="card-surface p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg text-choc">Measurement Vault</h2>
              <Link href="/account/measurements" className="font-sans text-xs text-nut">
                View full
              </Link>
            </div>
            {!measurements ? (
              <div className="text-center py-4">
                <p className="font-sans text-sm text-text-mid">No measurements saved yet</p>
                <Link href="/account/measurements" className="mt-3 inline-block font-sans text-xs text-nut underline">
                  Add measurements
                </Link>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ["Bust", measurements.bust],
                    ["Waist", measurements.waist],
                    ["Hips", measurements.hips],
                    ["Dress Length", measurements.dressLength],
                  ].map(([label, val]) => (
                    <div key={label as string} className="border border-sand/60 p-3 text-center">
                      <p className="font-display text-2xl text-choc">{val ?? "—"}</p>
                      <p className="font-sans text-[10px] uppercase text-text-light">{label}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 font-sans text-[11px] text-text-light">
                  Last updated: {formatDate(measurements.updatedAt)}
                </p>
              </>
            )}
          </section>

          <section className="card-surface p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg text-choc">Upcoming Events</h2>
              <Link href="/account/settings" className="font-sans text-xs text-nut">
                Add event
              </Link>
            </div>
            {eventDates.length === 0 ? (
              <p className="font-sans text-sm text-text-mid">No upcoming events saved</p>
            ) : (
              <ul className="space-y-3">
                {eventDates.map((ev) => {
                  const days = Math.ceil(
                    (ev.date.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
                  );
                  return (
                    <li key={ev.id} className="flex items-center gap-4 border border-sand/60 p-3">
                      <div className="text-center">
                        <p className="font-display text-xl text-choc">{ev.date.getDate()}</p>
                        <p className="font-sans text-[10px] uppercase text-text-light">
                          {ev.date.toLocaleString("en", { month: "short" })}
                        </p>
                      </div>
                      <div className="flex-1">
                        <p className="font-sans text-sm text-choc">{ev.label}</p>
                        {days <= 60 ? (
                          <Link href="/consultation" className="mt-1 block font-sans text-[11px] text-nut underline">
                            Book a consultation for this event
                          </Link>
                        ) : null}
                      </div>
                      <span className="rounded-sm bg-bg px-2 py-1 font-sans text-[10px] text-lightbr">
                        {days}d
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>

      {consultations.length > 0 ? (
        <section className="mt-10 card-surface p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl text-choc">Recent Consultations</h2>
            <Link href="/consultation" className="font-sans text-xs text-nut">
              Book a new consultation
            </Link>
          </div>
          <ul className="space-y-3">
            {consultations.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 border border-sand/60 p-3">
                <div>
                  <p className="font-sans text-sm text-choc">
                    {formatDate(c.confirmedDate ?? c.preferredDate1 ?? c.createdAt)} ·{" "}
                    {c.offering?.sessionType?.replace(/_/g, " ") ?? "Consultation"}
                  </p>
                  <p className="font-sans text-xs text-text-light">
                    {c.consultant?.name ?? "Consultant TBC"}
                  </p>
                </div>
                <span className="font-sans text-[10px] uppercase text-lightbr">{c.status}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {moodboards.length > 0 ? null : null}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  highlight,
  href,
  hrefLabel,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="card-surface p-5">
      <p className="font-sans text-[10px] uppercase tracking-wider text-text-light">{label}</p>
      <p className={`mt-2 font-display text-2xl ${highlight ? "text-nut" : "text-choc"}`}>{value}</p>
      {sub ? <p className="mt-1 font-sans text-xs text-text-mid">{sub}</p> : null}
      {href && hrefLabel ? (
        <Link href={href} className="mt-2 inline-block font-sans text-xs text-nut underline">
          {hrefLabel}
        </Link>
      ) : null}
    </div>
  );
}
