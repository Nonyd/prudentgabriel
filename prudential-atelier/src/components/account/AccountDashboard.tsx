import Link from "next/link";
import Image from "next/image";
import { getOfferingTypeLabel } from "@/lib/consultation-types";
import type { BespokeStage, LoyaltyTier, StageUpdate } from "@prisma/client";
import {
  Calendar,
  Check,
  Lock,
  Package,
  Ruler,
} from "lucide-react";
import { BespokeStageTracker } from "@/components/bespoke/BespokeStageTracker";
import { ConsultationBriefPanel } from "@/components/admin/ConsultationBriefPanel";
import { ProductCard } from "@/components/common/ProductCard";
import { ShareYourStoryCard } from "@/components/account/ShareYourStoryCard";
import { TIER_BENEFITS, TIER_LABELS } from "@/lib/loyalty";
import { formatDate, formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { ProductListItem } from "@/types/product";

export type DashboardState =
  | "new_client"
  | "has_consultation"
  | "has_active_order"
  | "returning_client";

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
  balance: number;
  stageHistory: StageUpdate[];
  consultationId?: string | null;
  occasionDetails?: string | null;
  occasionType?: string | null;
  outfitBrief?: string | null;
  sessionNotes?: string | null;
  moodboardImages?: string[];
  consultation?: { bookingNumber: string } | null;
};

type Consultation = {
  id: string;
  status: string;
  createdAt: Date;
  confirmedDate: Date | null;
  confirmedTime: string | null;
  preferredDate1: Date | null;
  description: string;
  consultant: { name: string | null } | null;
  offering: { sessionType: string | null; deliveryMode: string | null } | null;
};

type ConsultationMoodboard = {
  id: string;
  confirmedDate: Date | null;
  offeringType: string | null;
  moodboardImages: string[];
  moodboardNotes: string | null;
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
  progressPct: number;
  rtwActiveCount: number;
  bespokeActiveCount: number;
  balanceDue: number;
  memberSince: Date;
  dashboardState: DashboardState;
  styleProfileComplete: boolean;
  stylePreferences: {
    silhouettes: string[];
    colors: string[];
    occasions: string[];
  };
  rtwOrders: RtwOrder[];
  activeBespoke: BespokeOrder | undefined;
  upcomingConsultation: Consultation | null;
  consultations: Consultation[];
  consultationMoodboards: ConsultationMoodboard[];
  measurements: Measurements;
  eventDates: EventDate[];
  personalizedPicks: ProductListItem[];
  testimonialCard?: "write" | "pending" | null;
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatMemberSince(createdAt: Date): {
  duration: string;
  dateLabel: string;
  isNew: boolean;
} {
  const now = new Date();
  const months =
    (now.getFullYear() - createdAt.getFullYear()) * 12 + (now.getMonth() - createdAt.getMonth());

  const dateLabel = createdAt.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  if (months < 1) {
    return { duration: "New member", dateLabel, isNew: true };
  }
  if (months < 12) {
    return {
      duration: `${months} month${months === 1 ? "" : "s"}`,
      dateLabel,
      isNew: false,
    };
  }
  const years = Math.floor(months / 12);
  return {
    duration: `${years} year${years === 1 ? "" : "s"}`,
    dateLabel,
    isNew: false,
  };
}

function formatConsultationWhen(c: Consultation): string {
  const date = c.confirmedDate ?? c.preferredDate1 ?? c.createdAt;
  const dayLabel = formatDate(date);
  if (c.confirmedTime) return `${dayLabel} · ${c.confirmedTime}`;
  return dayLabel;
}

function sessionLabel(c: Consultation): string {
  const mode = c.offering?.deliveryMode?.replace(/_/g, " ") ?? "Consultation";
  const type = c.offering?.sessionType?.replace(/_/g, " ") ?? "";
  if (c.consultant?.name) {
    return `${mode} with ${c.consultant.name}`;
  }
  return type || mode;
}

function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-md border border-sand bg-ivory dark:border-sand/40 dark:bg-bg-card",
        className,
      )}
    >
      {children}
    </section>
  );
}

function StatCard({
  label,
  value,
  sub,
  href,
  hrefLabel,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  href?: string;
  hrefLabel?: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-md border border-sand bg-ivory p-5 dark:border-sand/40 dark:bg-bg-card">
      <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-text-light">
        {label}
      </p>
      <p
        className={cn(
          "mt-3 font-display text-[32px] font-normal leading-none text-choc dark:text-cream",
          highlight && "text-nut dark:text-cream",
        )}
      >
        {value}
      </p>
      {sub ? <p className="mt-2 font-sans text-[11px] font-light text-text-light">{sub}</p> : null}
      {href && hrefLabel ? (
        <Link
          href={href}
          className="mt-2 inline-flex font-sans text-[11px] font-medium text-nut underline-offset-2 hover:underline"
        >
          {hrefLabel}
        </Link>
      ) : null}
    </div>
  );
}

function EmptyBlock({
  icon: Icon,
  title,
  message,
  actionHref,
  actionLabel,
}: {
  icon: typeof Package;
  title: string;
  message: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <Icon className="h-10 w-10 text-sand" strokeWidth={1.25} aria-hidden />
      <p className="mt-4 font-display text-xl text-choc dark:text-cream">{title}</p>
      <p className="mt-2 max-w-sm font-sans text-sm text-text-light">{message}</p>
      <Link href={actionHref} className="btn-primary mt-5 inline-flex">
        {actionLabel}
      </Link>
    </div>
  );
}

function LoyaltyPanel({
  tier,
  points,
  toNext,
  nextTier,
  progressPct,
}: {
  tier: LoyaltyTier;
  points: number;
  toNext: number;
  nextTier: LoyaltyTier | null;
  progressPct: number;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="bg-[#442913] px-5 py-6 text-cream md:px-6">
        <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-lightbr">
          ✦ {TIER_LABELS[tier]} Member
        </p>
        <p className="mt-4 font-display text-[48px] leading-none">{points.toLocaleString()}</p>
        <p className="mt-1 font-sans text-sm text-sand">loyalty points</p>
        {nextTier ? (
          <>
            <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-lightbr transition-[width] duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="mt-2 font-sans text-xs text-sand">
              {toNext.toLocaleString()} points to {TIER_LABELS[nextTier]}
            </p>
          </>
        ) : (
          <p className="mt-4 font-sans text-sm text-sand">Maximum tier achieved ✦</p>
        )}
      </div>
      <div className="space-y-3 px-5 py-5 md:px-6">
        <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-text-light">
          Your perks
        </p>
        <ul className="space-y-2.5">
          {TIER_BENEFITS.map((b) => {
            const unlocked = b.tiers.includes(tier);
            return (
              <li key={b.label} className="flex items-center gap-2.5 font-sans text-xs">
                {unlocked ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-lightbr" strokeWidth={2} aria-hidden />
                ) : (
                  <Lock className="h-3.5 w-3.5 shrink-0 text-text-light" strokeWidth={1.75} aria-hidden />
                )}
                <span className={unlocked ? "text-choc dark:text-cream" : "text-text-light"}>
                  {b.label}
                </span>
              </li>
            );
          })}
        </ul>
        <Link
          href="/account/loyalty"
          className="inline-flex font-sans text-[11px] font-medium uppercase tracking-[0.1em] text-nut underline-offset-2 hover:underline"
        >
          View rewards →
        </Link>
      </div>
    </Card>
  );
}

function MeasurementVaultPanel({ measurements }: { measurements: Measurements }) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-3 border-b border-sand/50 px-5 py-4 dark:border-sand/30">
        <h2 className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-text-light">
          Measurement vault
        </h2>
        <Link href="/account/measurements" className="font-sans text-[11px] text-nut hover:underline">
          View full
        </Link>
      </div>
      {!measurements ? (
        <EmptyBlock
          icon={Ruler}
          title="Your measurements are safe with us forever"
          message="Add them once — we'll always have them ready for your next piece."
          actionHref="/account/measurements"
          actionLabel="Add measurements"
        />
      ) : (
        <div className="px-5 py-5 md:px-6">
          <div className="grid grid-cols-4 gap-2">
            {(
              [
                ["Bust", measurements.bust],
                ["Waist", measurements.waist],
                ["Hips", measurements.hips],
                ["Length", measurements.dressLength],
              ] as const
            ).map(([label, val]) => (
              <div key={label} className="text-center">
                <p className="font-display text-2xl leading-none text-choc dark:text-cream">
                  {val != null ? `${val}"` : "—"}
                </p>
                <p className="mt-1 font-sans text-[9px] font-semibold uppercase tracking-[0.1em] text-text-light">
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
    </Card>
  );
}

function EventsPanel({
  eventDates,
}: {
  eventDates: EventDate[];
}) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-3 border-b border-sand/50 px-5 py-4 dark:border-sand/30">
        <h2 className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-text-light">
          Upcoming events
        </h2>
        <Link href="/account/settings" className="font-sans text-[11px] text-nut hover:underline">
          Add event
        </Link>
      </div>
      {eventDates.length === 0 ? (
        <EmptyBlock
          icon={Calendar}
          title="Save your important dates"
          message="We'll remind you 8 weeks before — so you're always dressed for the moment."
          actionHref="/account/settings"
          actionLabel="Add event"
        />
      ) : (
        <ul className="divide-y divide-sand/50 dark:divide-sand/30">
          {eventDates.map((ev) => {
            const days = Math.ceil((ev.date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            return (
              <li key={ev.id} className="flex items-center gap-4 px-5 py-4 md:px-6">
                <div className="flex h-14 w-12 shrink-0 flex-col items-center justify-center rounded-sm border border-sand/60 bg-bg dark:border-sand/30 dark:bg-bg-page">
                  <p className="font-display text-xl leading-none text-choc dark:text-cream">
                    {ev.date.getDate()}
                  </p>
                  <p className="mt-0.5 font-sans text-[10px] font-semibold uppercase tracking-[0.08em] text-text-light">
                    {ev.date.toLocaleString("en", { month: "short" }).toUpperCase()}
                  </p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-sans text-sm font-medium text-choc dark:text-cream">{ev.label}</p>
                  <p className="mt-0.5 font-sans text-[11px] text-text-light">{days} days away</p>
                  {days <= 60 ? (
                    <Link
                      href="/consultation"
                      className="mt-1 inline-block font-sans text-[11px] text-nut underline-offset-2 hover:underline"
                    >
                      Book consultation →
                    </Link>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function StyleProfilePanel({
  complete,
  preferences,
}: {
  complete: boolean;
  preferences: AccountDashboardProps["stylePreferences"];
}) {
  const chips = [...preferences.silhouettes, ...preferences.colors, ...preferences.occasions].slice(0, 4);

  return (
    <Card className="h-full">
      <div className="border-b border-sand/50 px-5 py-4 dark:border-sand/30">
        <h2 className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-text-light">
          Your style profile
        </h2>
      </div>
      <div className="px-5 py-6 md:px-6">
        {!complete || chips.length === 0 ? (
          <>
            <p className="font-sans text-sm text-text-mid">
              Tell us about your style and we&apos;ll curate picks for you.
            </p>
            <Link
              href="/account/style-profile"
              className="mt-4 inline-flex font-sans text-[11px] font-medium uppercase tracking-[0.1em] text-nut underline-offset-2 hover:underline"
            >
              Complete your style profile →
            </Link>
          </>
        ) : (
          <div className="flex flex-wrap gap-2">
            {chips.map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-sand bg-bg px-3 py-1 font-sans text-[11px] text-text-mid dark:bg-bg-page"
              >
                {chip}
              </span>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

export function AccountDashboard({
  firstName,
  today,
  tier,
  points,
  toNext,
  nextTier,
  progressPct,
  bespokeActiveCount,
  balanceDue,
  memberSince,
  dashboardState,
  styleProfileComplete,
  stylePreferences,
  rtwOrders,
  activeBespoke,
  upcomingConsultation,
  consultationMoodboards = [],
  measurements,
  eventDates,
  personalizedPicks,
  testimonialCard = null,
}: AccountDashboardProps) {
  const greeting = getGreeting();
  const member = formatMemberSince(memberSince);
  const lastStage = activeBespoke?.stageHistory[0];
  const showPicks =
    dashboardState !== "new_client" || styleProfileComplete || personalizedPicks.length > 0;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="rounded-md border border-sand bg-ivory px-5 py-6 dark:border-sand/40 dark:bg-bg-card md:px-8 md:py-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-lightbr">
              Your atelier portal
            </p>
            <h1 className="mt-3 font-display text-[32px] font-normal leading-tight text-choc dark:text-cream md:text-[42px]">
              {greeting}, {firstName}.
            </h1>
            <p className="mt-2 font-sans text-xs font-light text-text-light">{today}</p>
            <p className="mt-4 font-sans text-xs text-text-mid">
              <span className="text-lightbr">✦</span> {TIER_LABELS[tier]} Member ·{" "}
              {points.toLocaleString()} points
            </p>
          </div>
          <Link
            href="/consultation"
            className="btn-primary shrink-0 self-start px-6 py-3 text-[10px] tracking-[0.2em]"
          >
            Book consultation
          </Link>
        </div>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Active commissions"
          value={bespokeActiveCount > 0 ? String(bespokeActiveCount) : "—"}
          sub={bespokeActiveCount === 0 ? "Begin a commission →" : undefined}
          href={bespokeActiveCount === 0 ? "/consultation" : "/account/orders"}
          hrefLabel={bespokeActiveCount === 0 ? "Begin a commission →" : undefined}
        />
        <StatCard
          label="Next reward"
          value={nextTier ? `${toNext.toLocaleString()} pts` : "—"}
          sub={
            nextTier
              ? `to ${TIER_LABELS[nextTier]}`
              : "Maximum tier achieved ✦"
          }
        />
        <StatCard
          label="Outstanding balance"
          value={balanceDue > 0 ? formatPrice(balanceDue, "NGN") : "—"}
          sub={balanceDue > 0 ? undefined : "No outstanding balance"}
          href={balanceDue > 0 ? "/account/orders" : undefined}
          hrefLabel={balanceDue > 0 ? "Pay now →" : undefined}
          highlight={balanceDue > 0}
        />
        <StatCard
          label="Member since"
          value={member.duration}
          sub={member.isNew ? "Welcome to the atelier ✦" : member.dateLabel}
        />
      </div>

      {testimonialCard ? <ShareYourStoryCard status={testimonialCard} /> : null}

      {dashboardState === "new_client" ? (
        <section className="mt-8 rounded-md bg-[#442913] px-6 py-10 text-cream md:px-10 md:py-12">
          <h2 className="font-display text-2xl md:text-3xl">
            Welcome to your Atelier Portal, {firstName}.
          </h2>
          <p className="mt-6 max-w-2xl font-display text-xl italic leading-relaxed text-cream/90 md:text-[22px]">
            &ldquo;Every great piece begins with a conversation. We design entirely around you.&rdquo;
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/consultation"
              className="inline-flex items-center justify-center rounded-sm bg-cream px-6 py-3 font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-choc transition-colors hover:bg-sand"
            >
              Begin your commission →
            </Link>
            <Link href="/shop" className="btn-ghost-dark justify-center px-6 py-3">
              Browse the collection →
            </Link>
          </div>
        </section>
      ) : null}

      {dashboardState === "has_consultation" && upcomingConsultation ? (
        <section className="mt-8 rounded-md bg-[#442913] px-6 py-8 text-cream md:px-10">
          <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-lightbr">
            Your upcoming consultation
          </p>
          <p className="mt-4 font-display text-[28px] leading-tight">{sessionLabel(upcomingConsultation)}</p>
          <p className="mt-2 font-display text-2xl text-cream/90">
            {formatConsultationWhen(upcomingConsultation)}
          </p>
          {upcomingConsultation.description ? (
            <p className="mt-4 max-w-xl font-display text-lg italic text-sand">
              &ldquo;{upcomingConsultation.description.slice(0, 120)}
              {upcomingConsultation.description.length > 120 ? "…" : ""}&rdquo;
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-4">
            <Link
              href={`/account/consultations/${upcomingConsultation.id}`}
              className="font-sans text-[11px] font-medium uppercase tracking-[0.1em] text-cream underline-offset-2 hover:underline"
            >
              View details
            </Link>
          </div>
        </section>
      ) : null}

      {consultationMoodboards.length > 0 ? (
        <section className="mt-8 rounded-md border border-sand bg-ivory px-6 py-8 dark:border-sand/40 dark:bg-bg-card md:px-10">
          <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-text-light">
            Your moodboard
          </p>
          {consultationMoodboards.map((board) => (
            <div key={board.id} className="mt-6 border-t border-sand/50 pt-6 first:mt-4 first:border-t-0 first:pt-0">
              <p className="font-sans text-sm text-text-mid">
                Consultation: {board.confirmedDate ? formatDate(board.confirmedDate) : "Recent"}
              </p>
              <p className="mt-1 font-sans text-sm font-medium text-choc dark:text-cream">
                With: {getOfferingTypeLabel(board.offeringType)}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {board.moodboardImages.map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative aspect-[4/5] overflow-hidden rounded-sm border border-sand"
                  >
                    <Image src={url} alt="" fill className="object-cover" sizes="(max-width:640px) 50vw, 200px" />
                  </a>
                ))}
              </div>
              {board.moodboardNotes ? (
                <p className="mt-4 font-body text-sm italic text-text-mid">
                  &ldquo;{board.moodboardNotes}&rdquo;
                </p>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      {dashboardState === "returning_client" ? (
        <>
          <section className="mt-8 rounded-md border border-sand bg-ivory px-6 py-8 dark:border-sand/40 dark:bg-bg-card md:px-10">
            <h2 className="font-display text-2xl text-choc dark:text-cream">Welcome back, {firstName}.</h2>
            <p className="mt-3 font-sans text-sm text-text-mid">
              It&apos;s been a while since your last commission. Ready for something new?
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link href="/consultation" className="btn-primary justify-center">
                Begin a new commission →
              </Link>
              <Link
                href="/shop"
                className="btn-ghost-light justify-center border-sand text-choc dark:text-cream"
              >
                Browse the collection →
              </Link>
            </div>
          </section>
          <div className="mt-8 grid gap-6 lg:grid-cols-12 lg:items-start">
            <div className="space-y-6 lg:col-span-7 xl:col-span-8">
              {rtwOrders.length > 0 ? (
                <Card>
                  <div className="border-b border-sand/50 px-5 py-4 dark:border-sand/30 md:px-6">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-text-light">
                        Past orders
                      </h2>
                      <Link href="/account/orders" className="font-sans text-[11px] text-nut hover:underline">
                        View all
                      </Link>
                    </div>
                  </div>
                  <ul className="divide-y divide-sand/50 dark:divide-sand/30">
                    {rtwOrders.slice(0, 3).map((o) => {
                      const item = o.items[0];
                      return (
                        <li key={o.id} className="px-5 py-4 md:px-6">
                          <p className="font-sans text-sm font-medium text-choc dark:text-cream">
                            {item?.product.name ?? "Order"}
                          </p>
                          <p className="mt-0.5 font-sans text-xs text-text-light">{formatDate(o.createdAt)}</p>
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              ) : null}
              <StyleProfilePanel complete={styleProfileComplete} preferences={stylePreferences} />
            </div>
            <aside className="space-y-6 lg:col-span-5 xl:col-span-4">
              <LoyaltyPanel
                tier={tier}
                points={points}
                toNext={toNext}
                nextTier={nextTier}
                progressPct={progressPct}
              />
              <MeasurementVaultPanel measurements={measurements} />
            </aside>
          </div>
        </>
      ) : null}

      {(dashboardState === "new_client" || dashboardState === "has_consultation") ? (
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <StyleProfilePanel complete={styleProfileComplete} preferences={stylePreferences} />
          <MeasurementVaultPanel measurements={measurements} />
        </div>
      ) : null}

      {dashboardState === "has_active_order" ? (
        <div className="mt-8 grid gap-6 lg:grid-cols-12 lg:items-start">
          <div className="space-y-6 lg:col-span-7 xl:col-span-8">
            {activeBespoke ? (
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sand/50 px-5 py-4 dark:border-sand/30 md:px-6">
                  <h2 className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-text-light">
                    Active commission
                  </h2>
                  <Link
                    href={`/track/${activeBespoke.trackingToken}`}
                    target="_blank"
                    className="font-sans text-[11px] font-medium uppercase tracking-[0.1em] text-nut hover:underline"
                  >
                    Track publicly →
                  </Link>
                </div>
                <div className="space-y-5 px-5 py-5 md:px-6 md:py-6">
                  <div>
                    <p className="font-display text-2xl text-choc dark:text-cream">
                      {activeBespoke.outfitDescription ?? "Bespoke commission"}
                    </p>
                    <p className="mt-1 font-sans text-xs uppercase tracking-[0.12em] text-lightbr">
                      {activeBespoke.orderRef}
                    </p>
                    {activeBespoke.deliveryDate ? (
                      <p className="mt-3 font-sans text-sm text-text-mid">
                        Delivery: {formatDate(activeBespoke.deliveryDate)}
                      </p>
                    ) : null}
                  </div>
                  {activeBespoke.consultationId ? (
                    <ConsultationBriefPanel
                      variant="client"
                      brief={{
                        bookingNumber: activeBespoke.consultation?.bookingNumber ?? "",
                        occasion: activeBespoke.occasionDetails ?? activeBespoke.occasionType ?? null,
                        outfitBrief:
                          activeBespoke.outfitBrief ??
                          activeBespoke.sessionNotes ??
                          activeBespoke.outfitDescription,
                        moodboardImages: activeBespoke.moodboardImages ?? [],
                        adminHref: "/account/moodboards",
                      }}
                    />
                  ) : null}
                  {lastStage?.notes ? (
                    <p className="rounded-sm border border-sand/60 bg-bg px-4 py-3 font-sans text-sm text-text-mid dark:bg-bg-page">
                      Last update: &ldquo;{lastStage.notes}&rdquo;
                    </p>
                  ) : null}
                  <BespokeStageTracker
                    currentStage={activeBespoke.currentStage}
                    stageHistory={activeBespoke.stageHistory}
                    compact
                  />
                  {activeBespoke.balance > 0 ? (
                    <div className="rounded-sm border border-sand/60 bg-[rgba(212,187,172,0.25)] px-4 py-3 font-sans text-sm text-nut dark:text-cream">
                      {formatPrice(activeBespoke.balance, "NGN")} remaining balance ·{" "}
                      <Link href="/account/orders" className="font-medium underline-offset-2 hover:underline">
                        Pay now →
                      </Link>
                    </div>
                  ) : null}
                  <Link
                    href="/account/orders"
                    className="inline-flex font-sans text-[11px] font-medium uppercase tracking-[0.1em] text-nut underline-offset-2 hover:underline"
                  >
                    View all commissions
                  </Link>
                </div>
              </Card>
            ) : (
              <Card>
                <EmptyBlock
                  icon={Package}
                  title="No active commissions"
                  message="Begin a new commission to bring your vision to life."
                  actionHref="/consultation"
                  actionLabel="Begin a commission →"
                />
              </Card>
            )}

            {rtwOrders.length > 0 ? (
              <Card>
                <div className="border-b border-sand/50 px-5 py-4 dark:border-sand/30 md:px-6">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-text-light">
                      Recent ready-to-wear
                    </h2>
                    <Link href="/account/orders" className="font-sans text-[11px] text-nut hover:underline">
                      View all orders
                    </Link>
                  </div>
                </div>
                <ul className="divide-y divide-sand/50 dark:divide-sand/30">
                  {rtwOrders.slice(0, 3).map((o) => {
                    const item = o.items[0];
                    const img = item?.product.images[0]?.url;
                    return (
                      <li key={o.id}>
                        <Link
                          href={`/account/orders/${o.id}`}
                          className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-bg dark:hover:bg-bg-page md:px-6"
                        >
                          <div className="relative h-16 w-12 shrink-0 overflow-hidden bg-bg dark:bg-bg-page">
                            {img ? (
                              <Image src={img} alt="" fill className="object-cover object-top" unoptimized />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center text-lightbr">
                                <Package className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-sans text-sm font-medium text-choc dark:text-cream">
                              {item?.product.name ?? "Order"}
                            </p>
                            <p className="mt-0.5 font-sans text-xs text-text-light">
                              {formatDate(o.createdAt)}
                            </p>
                          </div>
                          <span className="rounded-sm bg-bg px-2 py-1 font-sans text-[10px] font-semibold uppercase tracking-[0.08em] text-lightbr dark:bg-bg-page">
                            {o.status.replace(/_/g, " ")}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            ) : null}
          </div>

          <aside className="space-y-6 lg:col-span-5 xl:col-span-4">
            <LoyaltyPanel
              tier={tier}
              points={points}
              toNext={toNext}
              nextTier={nextTier}
              progressPct={progressPct}
            />
            <MeasurementVaultPanel measurements={measurements} />
            <EventsPanel eventDates={eventDates} />
          </aside>
        </div>
      ) : null}

      {showPicks && personalizedPicks.length > 0 ? (
        <section className="mt-10">
          <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-lightbr">
            Picked for you
          </p>
          <h2 className="mt-2 font-display text-2xl text-choc dark:text-cream">
            Curated for your taste
          </h2>
          <p className="mt-2 max-w-xl font-sans text-sm text-text-mid">
            Based on your style preferences and order history, we think you&apos;ll love these.
          </p>
          {!styleProfileComplete ? (
            <Link
              href="/account/style-profile"
              className="mt-2 inline-flex font-sans text-[11px] text-nut underline-offset-2 hover:underline"
            >
              Complete your style profile for more personalised picks
            </Link>
          ) : null}
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {personalizedPicks.map((product) => (
              <ProductCard key={product.id} product={product} compact />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
