import type { BespokeStage, ConsultationStatus, OrderStatus, PaymentStatus } from "@prisma/client";
import type { ClientStep } from "@/lib/atelier/pipeline";
import { rtwPaidInChargedCurrency, type RtwPaidDisplay } from "@/lib/rtw-tracker";

export function clientFirstName(fullName: string): string {
  const part = fullName.trim().split(/\s+/)[0];
  return part || "Client";
}

export type PublicTrackDto = {
  orderRef: string;
  status: OrderStatus;
  /** The lead step, kept for callers that read one stage. */
  currentStage: BespokeStage;
  /** Her order's real steps: skipped ones left out, several can be in progress. */
  steps: Pick<ClientStep, "number" | "label" | "description" | "status">[];
  clientFirstName: string;
  expectedDelivery: string | null;
};

export function toPublicTrackDto(order: {
  orderRef: string;
  status: OrderStatus;
  currentStage: BespokeStage;
  clientName: string;
  deliveryDate: Date | null;
  steps?: ClientStep[];
}): PublicTrackDto {
  return {
    orderRef: order.orderRef,
    status: order.status,
    currentStage: order.currentStage,
    // No step ids on a public link: name, words for her, and where it stands.
    steps: (order.steps ?? []).map((s) => ({
      number: s.number,
      label: s.label,
      description: s.description,
      status: s.status,
    })),
    clientFirstName: clientFirstName(order.clientName),
    expectedDelivery: order.deliveryDate ? order.deliveryDate.toISOString() : null,
  };
}

/**
 * Read by booking number alone (CB-YY-NNNNN, about 100,000 a year), so it says
 * nothing about who she is: no name, not even a first one (token sweep).
 */
export type PublicConsultationDto = {
  bookingNumber: string;
  status: ConsultationStatus;
  paymentStatus: PaymentStatus;
  offeringName: string | null;
  consultantName: string | null;
  confirmedDate: string | null;
  confirmedTime: string | null;
  /** For the "how to prepare" notes: in the atelier or on a call, and how long. */
  isVirtual: boolean;
  durationMinutes: number;
};

export function toPublicConsultationDto(booking: {
  bookingNumber: string;
  status: ConsultationStatus;
  paymentStatus: PaymentStatus;
  clientName: string;
  confirmedDate: Date | null;
  confirmedTime: string | null;
  offeringType?: string | null;
  offering?: { sessionType?: string | null; deliveryMode?: string | null; durationMinutes?: number | null } | null;
  consultant?: { name?: string | null } | null;
}): PublicConsultationDto {
  // Offering types and delivery modes both name the virtual ones VIRTUAL_*.
  const isVirtual = Boolean(
    booking.offeringType?.startsWith("VIRTUAL") || booking.offering?.deliveryMode?.startsWith("VIRTUAL"),
  );
  return {
    isVirtual,
    durationMinutes: booking.offering?.durationMinutes ?? 90,
    bookingNumber: booking.bookingNumber,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    offeringName: booking.offering?.sessionType ?? null,
    consultantName: booking.consultant?.name ?? null,
    confirmedDate: booking.confirmedDate ? booking.confirmedDate.toISOString() : null,
    confirmedTime: booking.confirmedTime,
  };
}

/** Public RTW tracker. Order number, items, size, what she paid, status — nothing else. */
export type PublicRtwOrderDto = {
  orderNumber: string;
  status: string;
  paymentStatus: PaymentStatus;
  paid: RtwPaidDisplay;
  items: {
    name: string;
    size: string;
    quantity: number;
  }[];
};

export function toPublicRtwOrderDto(order: {
  orderNumber: string;
  status: string;
  paymentStatus: PaymentStatus;
  total: number;
  currency?: string | null;
  fxUsdAmountLocked?: number | null;
  fxGbpAmountLocked?: number | null;
  fxRateLocked?: number | null;
  fxGbpRateLocked?: number | null;
  items: {
    product: { name: string };
    size: string | null;
    sizeMode?: string | null;
    optionLabel?: string | null;
    quantity: number;
  }[];
}): PublicRtwOrderDto {
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paid: rtwPaidInChargedCurrency(order),
    items: order.items.map((i) => ({
      name: i.product.name,
      size: [
        i.optionLabel?.trim() || null,
        i.sizeMode === "CUSTOM" ? "Made to your measurements" : (i.size ?? "—"),
      ]
        .filter(Boolean)
        .join(", "),
      quantity: i.quantity,
    })),
  };
}

export function actorOwnsBespokeOrder(params: {
  actorId: string;
  actorEmail?: string | null;
  clientEmail: string | null;
  profileUserId?: string | null;
}): boolean {
  if (params.profileUserId && params.profileUserId === params.actorId) return true;
  if (
    params.clientEmail &&
    params.actorEmail &&
    params.clientEmail.toLowerCase() === params.actorEmail.toLowerCase()
  ) {
    return true;
  }
  return false;
}
