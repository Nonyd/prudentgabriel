import Link from "next/link";
import Image from "next/image";
import type { BespokeStage, LoyaltyTier, StageUpdate } from "@prisma/client";
import {
  AlertCircle,
  Calendar,
  Check,
  Crown,
  Lock,
  Package,
  Ruler,
  ShoppingBag,
  Sparkles,
  Wallet,
} from "lucide-react";
import { BespokeStageTracker } from "@/components/bespoke/BespokeStageTracker";
import { STAGE_SHORT_LABELS } from "@/lib/bespoke-stages";
import { TIER_BENEFITS, TIER_LABELS } from "@/lib/loyalty";
import { formatDate, formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";

type RtwOrder = {
  id: string;
  createdAt: Date;
  total: number;
  status: string;
  items: Array<{
    size: string | null;
    product: {
      name: string;
      images: Array<{ url: string }>;
    };
  }>;
};

type BespokeOrder = {
  id: string;
  orderRef: string;
  outfitDescription: string | null;
  deliveryDate: Date | null;
  currentStage: BespokeStage;
  trackingToken: string;
  stageHistory: StageUpdate[];
};

type Consultation = {
  id: string;
  status: string;
  createdAt: Date;
  confirmedDate: Date | null;
  preferredDate1: Date | null;
  consultant: { name: string | null } | null;
  offering: { sessionType: string | null; deliveryMode: string | null } | null;
};

type Measurements = {
  bust: number | null;
  waist: number | null;
  hips: number | null;
  dressLength: number | null;
  updatedAt: Date;
} | null;

type EventDate = {
  id: string;
  label: string;
  date: Date;
};

export type AccountDashboardProps = {
  firstName: string;
  today: string;
  tier: LoyaltyTier;
  points: number;
  toNext: number;
  nextTier: LoyaltyTier | null;
  rtwActiveCount: number;
  bespokeActiveCount: number;
  totalSpend: number;
  balanceDue: number;
  rtwOrders: RtwOrder[];
  activeBespoke: BespokeOrder | undefined;
  consultations: Consultation[];
  measurements: Measurements;
  eventDates: EventDate[];
};

function Panel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-sm border border-sand/70 bg-white shadow-[0_1px_0_rgba(68,41,19,0.04)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

function PanelHeader({
  title,
  href,
  hrefLabel,
}: {
  title: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-sand/50 px-5 py-4 md:px-6">
      <h2 className="font-display text-xl text-choc">{title}</h2>
      {href && hrefLabel ? (
        <Link
          href={href}
          className="shrink-0 font-sans text-[11px] font-medium uppercase tracking-[0.1em] text-nut transition-colors hover:text-choc"
        >
          {hrefLabel}
        </Link>
      ) : null}
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  highlight,
  href,
  hrefLabel,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: typeof Package;
  highlight?: boolean;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="flex flex-col justify-between rounded-sm border border-sand/70 bg-white p-5 shadow-[0_1px_0_rgba(68,41,19,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-text-light">
          {label}
        </p>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ivory text-lightbr">
          <Icon className="h-4 w-4" strokeWidth={1.5} aria-hidden />
        </span>
      </div>
      <div className="mt-4">
        <p className={cn("font-display text-[28px] leading-none", highlight ? "text-nut" : "text-choc")}>
          {value}
        </p>
        {sub ? <p className="mt-2 font-sans text-xs text-text-mid">{sub}</p> : null}
        {href && hrefLabel ? (
          <Link
            href={href}
            className="mt-3 inline-flex font-sans text-[11px] font-medium text-nut underline-offset-2 hover:underline"
          >
            {hrefLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  message,
  actionHref,
  actionLabel,
}: {
  icon: typeof Package;
  message: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ivory text-lightbr">
        <Icon className="h-5 w-5" strokeWidth={1.5} aria-hidden />
      </span>
      <p className="mt-4 max-w-xs font-sans text-sm text-text-mid">{message}</p>
      <Link href={actionHref} className="btn-primary mt-5 inline-flex">
        {actionLabel}
      </Link>
    </div>
  );
}

export function AccountDashboard({
  firstName,
  today,
  tier,
  points,
  toNext,
  nextTier,
  rtwActiveCount,
  bespokeActiveCount,
  totalSpend,
  balanceDue,
  rtwOrders,
  activeBespoke,
  consultations,
  measurements,
  eventDates,
}: AccountDashboardProps) {
  const progressPct = nextTier
    ? Math.min(100, Math.round((points / (points + toNext)) * 100))
    : 100;
  const lastStage = activeBespoke?.stageHistory[0];

  return (
    <div className="mx-auto max-w-6xl">
      <header className="rounded-sm border border-sand/70 bg-white px-5 py-6 shadow-[0_1px_0_rgba(68,41,19,0.04)] md:px-8 md:py-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-lightbr">
              Your atelier portal
            </p>
            <h1 className="mt-2 font-display text-[32px] leading-[1.05] text-choc md:text-[40px]">
              Welcome back, {firstName}
            </h1>
            <p className="mt-2 font-sans text-sm text-text-mid">{today}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-sm border border-lightbr/35 bg-ivory px-2.5 py-1 font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-nut">
                <Crown className="h-3 w-3 text-lightbr" strokeWidth={1.75} aria-hidden />
                {TIER_LABELS[tier]}
              </span>
              <span className="font-sans text-sm text-text-mid">
                <span className="font-display text-lg text-choc">{points.toLocaleString()}</span> loyalty points
              </span>
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
            <Link href="/consultation" className="btn-primary justify-center text-center">
              Book consultation
            </Link>
            <Link
              href="/shop"
              className="btn-ghost-light justify-center text-center"
            >
              Browse shop
            </Link>
          </div>
        </div>
      </header>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Active orders"
          value={String(rtwActiveCount + bespokeActiveCount)}
          icon={Package}
        />
        <StatTile
          label="Total spent"
          value={formatPrice(totalSpend, "NGN")}
          icon={Wallet}
        />
        <StatTile
          label="Loyalty points"
          value={points.toLocaleString()}
          sub={nextTier ? `${toNext.toLocaleString()} to ${TIER_LABELS[nextTier]}` : "Top tier reached"}
          icon={Sparkles}
        />
        <StatTile
          label="Outstanding balance"
          value={balanceDue > 0 ? formatPrice(balanceDue, "NGN") : "—"}
          highlight={balanceDue > 0}
          href={balanceDue > 0 ? "/account/orders" : undefined}
          hrefLabel={balanceDue > 0 ? "Pay now" : undefined}
          icon={AlertCircle}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-12 lg:items-start">
        <div className="space-y-6 lg:col-span-8">
          {activeBespoke ? (
            <Panel>
              <PanelHeader title="Active bespoke commission" href="/account/orders" hrefLabel="All orders" />
              <div className="space-y-5 px-5 py-5 md:px-6 md:py-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-lightbr">
                      {activeBespoke.orderRef}
                    </p>
                    {activeBespoke.outfitDescription ? (
                      <p className="mt-2 line-clamp-2 font-sans text-sm leading-relaxed text-text-mid">
                        {activeBespoke.outfitDescription}
                      </p>
                    ) : null}
                    {activeBespoke.deliveryDate ? (
                      <p className="mt-3 font-sans text-xs text-nut">
                        Delivery target: {formatDate(activeBespoke.deliveryDate)}
                      </p>
                    ) : null}
                  </div>
                  <span className="rounded-sm bg-nut/10 px-2.5 py-1 font-sans text-[10px] font-semibold uppercase tracking-[0.08em] text-nut">
                    {STAGE_SHORT_LABELS[activeBespoke.currentStage]}
                  </span>
                </div>
                {lastStage?.notes ? (
                  <p className="rounded-sm border border-sand/60 bg-ivory px-4 py-3 font-sans text-sm text-text-mid">
                    {lastStage.notes}
                  </p>
                ) : null}
                <BespokeStageTracker
                  currentStage={activeBespoke.currentStage}
                  stageHistory={activeBespoke.stageHistory}
                  compact
                />
                <div className="flex flex-wrap gap-4 border-t border-sand/50 pt-4">
                  <Link
                    href={`/track/${activeBespoke.trackingToken}`}
                    target="_blank"
                    className="font-sans text-xs font-medium text-nut underline-offset-2 hover:underline"
                  >
                    Track commission
                  </Link>
                </div>
              </div>
            </Panel>
          ) : null}

          <Panel>
            <PanelHeader title="Recent ready-to-wear orders" href="/account/orders" hrefLabel="View all" />
            {rtwOrders.length === 0 ? (
              <EmptyState
                icon={ShoppingBag}
                message="No orders yet. Explore the collection when you are ready."
                actionHref="/shop"
                actionLabel="Shop now"
              />
            ) : (
              <ul className="divide-y divide-sand/50">
                {rtwOrders.map((o) => {
                  const item = o.items[0];
                  const img = item?.product.images[0]?.url;
                  return (
                    <li key={o.id}>
                      <Link
                        href={`/account/orders/${o.id}`}
                        className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-ivory/80 md:px-6"
                      >
                        <div className="relative h-16 w-12 shrink-0 overflow-hidden bg-ivory">
                          {img ? (
                            <Image src={img} alt="" fill className="object-cover object-top" unoptimized />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-lightbr">
                              <Package className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-sans text-sm font-medium text-choc">
                            {item?.product.name ?? "Order"}
                          </p>
                          <p className="mt-0.5 font-sans text-xs text-text-light">
                            {formatDate(o.createdAt)}
                            {item?.size ? ` · Size ${item.size}` : ""}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-sans text-sm font-medium text-choc">{formatPrice(o.total, "NGN")}</p>
                          <span className="mt-1 inline-block font-sans text-[10px] font-semibold uppercase tracking-[0.08em] text-lightbr">
                            {o.status.replace(/_/g, " ")}
                          </span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          {consultations.length > 0 ? (
            <Panel>
              <PanelHeader title="Recent consultations" href="/consultation" hrefLabel="Book new" />
              <ul className="divide-y divide-sand/50">
                {consultations.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 md:px-6"
                  >
                    <div className="min-w-0">
                      <p className="font-sans text-sm font-medium text-choc">
                        {formatDate(c.confirmedDate ?? c.preferredDate1 ?? c.createdAt)}
                      </p>
                      <p className="mt-0.5 font-sans text-xs text-text-light">
                        {c.offering?.sessionType?.replace(/_/g, " ") ?? "Consultation"}
                        {c.consultant?.name ? ` · ${c.consultant.name}` : ""}
                      </p>
                    </div>
                    <span className="rounded-sm bg-ivory px-2 py-1 font-sans text-[10px] font-semibold uppercase tracking-[0.08em] text-lightbr">
                      {c.status.replace(/_/g, " ")}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>

        <aside className="space-y-6 lg:col-span-4">
          <Panel className="overflow-hidden">
            <div className="border-b border-sand/50 bg-choc px-5 py-5 text-cream md:px-6">
              <div className="flex items-center justify-between gap-3">
                <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-lightbr">
                  Loyalty status
                </p>
                <Crown className="h-4 w-4 text-lightbr" strokeWidth={1.5} aria-hidden />
              </div>
              <p className="mt-3 font-display text-[42px] leading-none">{points.toLocaleString()}</p>
              <p className="mt-1 font-sans text-sm text-cream/80">{TIER_LABELS[tier]} member</p>
            </div>
            <div className="space-y-4 px-5 py-5 md:px-6">
              {nextTier ? (
                <div>
                  <div className="flex items-center justify-between gap-2 font-sans text-xs text-text-mid">
                    <span>Progress to {TIER_LABELS[nextTier]}</span>
                    <span>{progressPct}%</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ivory">
                    <div className="h-full rounded-full bg-lightbr transition-[width] duration-300" style={{ width: `${progressPct}%` }} />
                  </div>
                  <p className="mt-2 font-sans text-xs text-text-light">
                    {toNext.toLocaleString()} points remaining
                  </p>
                </div>
              ) : (
                <p className="font-sans text-sm text-text-mid">You have reached our highest loyalty tier.</p>
              )}
              <ul className="space-y-2.5 border-t border-sand/50 pt-4">
                {TIER_BENEFITS.map((b) => {
                  const unlocked = b.tiers.includes(tier);
                  return (
                    <li key={b.label} className="flex items-center gap-2.5 font-sans text-xs">
                      {unlocked ? (
                        <Check className="h-3.5 w-3.5 shrink-0 text-nut" strokeWidth={2} aria-hidden />
                      ) : (
                        <Lock className="h-3.5 w-3.5 shrink-0 text-text-light" strokeWidth={1.75} aria-hidden />
                      )}
                      <span className={unlocked ? "text-choc" : "text-text-light"}>{b.label}</span>
                    </li>
                  );
                })}
              </ul>
              <Link
                href="/account/loyalty"
                className="inline-flex font-sans text-[11px] font-medium uppercase tracking-[0.1em] text-nut underline-offset-2 hover:underline"
              >
                View rewards
              </Link>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Measurement vault" href="/account/measurements" hrefLabel="View full" />
            {!measurements ? (
              <div className="px-5 py-8 text-center md:px-6">
                <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-ivory text-lightbr">
                  <Ruler className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                </span>
                <p className="mt-3 font-sans text-sm text-text-mid">No measurements saved yet</p>
                <Link
                  href="/account/measurements"
                  className="mt-4 inline-flex font-sans text-[11px] font-medium uppercase tracking-[0.1em] text-nut underline-offset-2 hover:underline"
                >
                  Add measurements
                </Link>
              </div>
            ) : (
              <div className="px-5 py-5 md:px-6">
                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      ["Bust", measurements.bust],
                      ["Waist", measurements.waist],
                      ["Hips", measurements.hips],
                      ["Length", measurements.dressLength],
                    ] as const
                  ).map(([label, val]) => (
                    <div
                      key={label}
                      className="rounded-sm border border-sand/60 bg-ivory px-3 py-3 text-center"
                    >
                      <p className="font-display text-2xl leading-none text-choc">{val ?? "—"}</p>
                      <p className="mt-1 font-sans text-[10px] font-semibold uppercase tracking-[0.1em] text-text-light">
                        {label}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="mt-4 font-sans text-[11px] text-text-light">
                  Updated {formatDate(measurements.updatedAt)}
                </p>
              </div>
            )}
          </Panel>

          <Panel>
            <PanelHeader title="Upcoming events" href="/account/settings" hrefLabel="Add event" />
            {eventDates.length === 0 ? (
              <div className="px-5 py-8 text-center md:px-6">
                <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-ivory text-lightbr">
                  <Calendar className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                </span>
                <p className="mt-3 font-sans text-sm text-text-mid">No upcoming events saved</p>
                <Link
                  href="/account/settings"
                  className="mt-4 inline-flex font-sans text-[11px] font-medium uppercase tracking-[0.1em] text-nut underline-offset-2 hover:underline"
                >
                  Add an event
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-sand/50">
                {eventDates.map((ev) => {
                  const days = Math.ceil((ev.date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  return (
                    <li key={ev.id} className="flex items-center gap-4 px-5 py-4 md:px-6">
                      <div className="flex h-14 w-12 shrink-0 flex-col items-center justify-center rounded-sm border border-sand/60 bg-ivory">
                        <p className="font-display text-xl leading-none text-choc">{ev.date.getDate()}</p>
                        <p className="mt-0.5 font-sans text-[10px] font-semibold uppercase tracking-[0.08em] text-text-light">
                          {ev.date.toLocaleString("en", { month: "short" })}
                        </p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-sans text-sm font-medium text-choc">{ev.label}</p>
                        {days <= 60 ? (
                          <Link
                            href="/consultation"
                            className="mt-1 inline-block font-sans text-[11px] text-nut underline-offset-2 hover:underline"
                          >
                            Book consultation for this date
                          </Link>
                        ) : null}
                      </div>
                      <span className="rounded-sm bg-ivory px-2 py-1 font-sans text-[10px] font-semibold text-lightbr">
                        {days}d
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </aside>
      </div>
    </div>
  );
}
