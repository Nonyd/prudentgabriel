import { BespokeStage, OrderStatus, Prisma } from "@prisma/client";
import { STAGE_ORDER, getStageProgress } from "@/lib/bespoke-stages";
import { pipelineBlockFor, type PipelineBlock } from "@/lib/atelier/stage-requirements";

/**
 * Slice BD1 — the pipeline reads like a job board, not a mailing list.
 *
 * "Mrs. Prudent — 60th birthday outfit — 25 November": her name, the occasion,
 * and the delivery date. All three are already on the commission, so the title
 * is composed; the house types its own only where the composition reads badly.
 */

/** Enquiry occasion labels (ENQUIRY_OCCASIONS) as a title reads them. */
const OCCASION_IN_A_TITLE: Record<string, string> = {
  Bride: "Bridal",
};

export type TitleParts = {
  clientName: string;
  occasionType: string | null;
  occasionDetails: string | null;
  deliveryDate: Date | string | null;
  title: string | null;
};

/**
 * What the commission is for. Her own words win when they say more than the
 * label ("60th birthday outfit" over "Birthday dress"; anything under "Other").
 */
export function occasionPhrase(p: Pick<TitleParts, "occasionType" | "occasionDetails">): string | null {
  const type = p.occasionType?.trim() || null;
  const details = p.occasionDetails?.trim() || null;
  if (details && details !== type) return details;
  if (!type || type === "Other") return null;
  return OCCASION_IN_A_TITLE[type] ?? type;
}

/** "25 November" in Lagos. */
export function titleDate(value: Date | string | null): string | null {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: "Africa/Lagos" }).format(
    new Date(value),
  );
}

export type CommissionTitle = {
  text: string;
  /** The house typed it. */
  override: boolean;
  /** Composed without an occasion: a hint to add one, or a title. */
  partial: boolean;
};

export function commissionTitle(p: TitleParts): CommissionTitle {
  const own = p.title?.trim();
  if (own) return { text: own, override: true, partial: false };
  const occasion = occasionPhrase(p);
  const parts = [p.clientName.trim() || null, occasion, titleDate(p.deliveryDate)].filter(Boolean);
  return { text: parts.join(" — "), override: false, partial: !occasion };
}

/* ── BD5: commissions with no fabric ─────────────────────────────────────── */

const FABRIC_INDEX = STAGE_ORDER.indexOf("FABRIC_SOURCING");
/** Stages at or before fabric sourcing. */
export const STAGES_UP_TO_FABRIC: BespokeStage[] = STAGE_ORDER.slice(0, FABRIC_INDEX + 1);

const CLOSED: OrderStatus[] = [OrderStatus.DELIVERED, OrderStatus.ARCHIVED, OrderStatus.CANCELLED];

/**
 * Open, and fabric sourcing not passed — read from the stage engine: no live
 * completion of FABRIC_SOURCING, and the commission has not moved past it.
 * No "fabric sourced" flag that could disagree with the stages.
 */
export function fabricPendingWhere(): Prisma.BespokeOrderWhereInput {
  return {
    status: { notIn: CLOSED },
    currentStage: { in: STAGES_UP_TO_FABRIC },
    stageCompletions: { none: { stage: "FABRIC_SOURCING", revertedAt: null } },
  };
}

/** Pure twin of fabricPendingWhere, for a row already loaded. */
export function isFabricPending(o: {
  status: OrderStatus;
  currentStage: BespokeStage;
  liveStages: Iterable<BespokeStage>;
}): boolean {
  if (CLOSED.includes(o.status)) return false;
  if (!STAGES_UP_TO_FABRIC.includes(o.currentStage)) return false;
  for (const s of o.liveStages) if (s === "FABRIC_SOURCING") return false;
  return true;
}

/* ── The row ─────────────────────────────────────────────────────────────── */

export const commissionListSelect = {
  id: true,
  orderRef: true,
  clientProfileId: true,
  clientName: true,
  clientPhone: true,
  title: true,
  occasionType: true,
  occasionDetails: true,
  clientLocation: true,
  eventLocation: true,
  eventDate: true,
  deliveryDate: true,
  deliveredAt: true,
  currentStage: true,
  status: true,
  balance: true,
  createdAt: true,
  garmentType: { select: { key: true, label: true } },
  features: { select: { featureId: true, feature: { select: { key: true, label: true } } } },
  stageApprovals: { where: { status: "PENDING" as const }, select: { stage: true } },
  stageCompletions: { where: { revertedAt: null }, select: { stage: true } },
} satisfies Prisma.BespokeOrderSelect;

type ListSource = Prisma.BespokeOrderGetPayload<{ select: typeof commissionListSelect }>;

export type CommissionRow = {
  id: string;
  orderRef: string;
  clientProfileId: string | null;
  clientName: string;
  title: CommissionTitle;
  phone: string | null;
  /** Where she lives; null before enquiries asked (1 October) or on hand-made commissions. */
  place: string | null;
  deliveryDate: string | null;
  /** Only when it is a different day from the delivery date. */
  eventDate: string | null;
  garment: { key: string; label: string } | null;
  features: { key: string; label: string }[];
  currentStage: BespokeStage;
  progress: number;
  status: OrderStatus;
  /** Server-decided, so the balance itself never travels to a non-money viewer. */
  block: PipelineBlock;
  fabricPending: boolean;
  deliveredAt: string | null;
};

const iso = (d: Date | null) => (d ? d.toISOString() : null);
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

/**
 * One row for the pipeline. No email (BD1), and nothing about money for anyone:
 * the "awaiting balance" pill is decided here, so the balance never travels.
 */
export function commissionRow(o: ListSource): CommissionRow {
  const live = o.stageCompletions.map((c) => c.stage);
  const pendingApproval = o.stageApprovals.some((a) => a.stage === o.currentStage);
  const eventDay = day(o.eventDate);
  return {
    id: o.id,
    orderRef: o.orderRef,
    clientProfileId: o.clientProfileId,
    clientName: o.clientName,
    title: commissionTitle(o),
    phone: o.clientPhone,
    place: o.clientLocation,
    deliveryDate: iso(o.deliveryDate),
    eventDate: eventDay && eventDay !== day(o.deliveryDate) ? eventDay : null,
    garment: o.garmentType,
    features: o.features.map((f) => f.feature),
    currentStage: o.currentStage,
    progress: getStageProgress(o.currentStage),
    status: o.status,
    block:
      o.status === OrderStatus.ARCHIVED || o.currentStage === "DELIVERY"
        ? null
        : pipelineBlockFor({ currentStage: o.currentStage, pendingApproval, balance: o.balance }),
    fabricPending: isFabricPending({ status: o.status, currentStage: o.currentStage, liveStages: live }),
    deliveredAt: iso(o.deliveredAt),
  };
}

/* ── BD1: what the enquiry already holds, carried at convert ──────────────── */

const clean = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

/**
 * The enquiry asks (since 1 October) for the occasion in her words, the event
 * day and place, and where she lives. Convert copies them so the pipeline row
 * fills itself. Same rule as the BD migration's backfill.
 */
export function carriedFromEnquiry(
  e: {
    eventDate: Date | null;
    eventLocation: string | null;
    occasionDetails: string | null;
    presentCity: string | null;
    presentState: string | null;
    presentCountry: string | null;
  } | null,
): { eventDate: Date | null; eventLocation: string | null; clientLocation: string | null; occasionDetails: string | null } {
  if (!e) return { eventDate: null, eventLocation: null, clientLocation: null, occasionDetails: null };
  const place = [clean(e.presentCity), clean(e.presentState), clean(e.presentCountry)].filter(Boolean).join(", ");
  return {
    eventDate: e.eventDate ?? null,
    eventLocation: clean(e.eventLocation),
    clientLocation: place || null,
    occasionDetails: clean(e.occasionDetails),
  };
}
