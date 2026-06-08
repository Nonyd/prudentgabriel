import type { BespokeStage, CustomerNotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { STAGE_SHORT_LABELS } from "@/lib/bespoke-stages";

export type ClientNotificationType =
  | "CONSULTATION_CONFIRMED"
  | "MEETING_LINK_SENT"
  | "ATELIER_STAGE_ADVANCED"
  | "MOODBOARD_READY"
  | "INVOICE_ISSUED"
  | "QUOTE_READY"
  | "PAYMENT_CONFIRMED"
  | "BALANCE_REMINDER"
  | "ORDER_SHIPPED"
  | "ORDER_DELIVERED"
  | "REVIEW_REQUEST"
  | "LOYALTY_TIER_UPGRADE"
  | "EVENT_REMINDER"
  | "REFERRAL_REWARD";

function mapClientType(type: ClientNotificationType): CustomerNotificationType {
  switch (type) {
    case "CONSULTATION_CONFIRMED":
    case "MEETING_LINK_SENT":
    case "MOODBOARD_READY":
      return "CONSULTATION";
    case "ATELIER_STAGE_ADVANCED":
      return "BESPOKE_STAGE";
    case "INVOICE_ISSUED":
    case "QUOTE_READY":
    case "ORDER_SHIPPED":
    case "ORDER_DELIVERED":
    case "REVIEW_REQUEST":
      return "ORDER_UPDATE";
    case "PAYMENT_CONFIRMED":
    case "BALANCE_REMINDER":
      return "PAYMENT";
    case "LOYALTY_TIER_UPGRADE":
    case "REFERRAL_REWARD":
      return "LOYALTY";
    case "EVENT_REMINDER":
      return "GENERAL";
    default:
      return "GENERAL";
  }
}

async function resolveUserIdForBespoke(
  clientProfileId: string | null,
  clientEmail: string,
): Promise<string | null> {
  if (clientProfileId) {
    const profile = await prisma.clientProfile.findUnique({
      where: { id: clientProfileId },
      select: { userId: true },
    });
    if (profile?.userId) return profile.userId;
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: clientEmail.trim(), mode: "insensitive" } },
    select: { id: true },
  });
  return user?.id ?? null;
}

export async function resolveUserIdByEmail(email: string): Promise<string | null> {
  const user = await prisma.user.findFirst({
    where: { email: { equals: email.trim(), mode: "insensitive" } },
    select: { id: true },
  });
  return user?.id ?? null;
}

export async function createCustomerNotification(params: {
  userId: string;
  type: CustomerNotificationType;
  title: string;
  message: string;
  link?: string;
  entityId?: string;
}): Promise<void> {
  await prisma.customerNotification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      link: params.link ?? null,
      entityId: params.entityId ?? null,
    },
  });
}

/** Spec alias — maps granular client types to stored CustomerNotificationType. */
export async function createClientNotification(params: {
  userId: string;
  type: ClientNotificationType;
  title: string;
  message: string;
  link?: string;
  entityId?: string;
}): Promise<void> {
  await createCustomerNotification({
    userId: params.userId,
    type: mapClientType(params.type),
    title: params.title,
    message: params.message,
    link: params.link,
    entityId: params.entityId,
  });
}

export function notifyClientBespokeStageComplete(params: {
  orderId: string;
  orderRef: string;
  stage: BespokeStage;
  trackingToken: string;
  clientProfileId: string | null;
  clientEmail: string;
}): void {
  void (async () => {
    const userId = await resolveUserIdForBespoke(params.clientProfileId, params.clientEmail);
    if (!userId) return;

    const stageLabel = STAGE_SHORT_LABELS[params.stage];
    await createClientNotification({
      userId,
      type: "ATELIER_STAGE_ADVANCED",
      title: "Atelier stage complete",
      message: `${params.orderRef} — ${stageLabel} is complete. View your commission progress.`,
      link: `/track/${params.trackingToken}`,
      entityId: params.orderId,
    });
  })().catch(() => {});
}

export function notifyConsultationConfirmed(params: {
  userId: string | null;
  clientEmail: string;
  bookingId: string;
  bookingNumber: string;
}): void {
  void (async () => {
    const userId = params.userId ?? (await resolveUserIdByEmail(params.clientEmail));
    if (!userId) return;
    await createClientNotification({
      userId,
      type: "CONSULTATION_CONFIRMED",
      title: "Consultation confirmed",
      message: `Your consultation #${params.bookingNumber} is confirmed.`,
      link: `/account/consultations`,
      entityId: params.bookingId,
    });
  })().catch(() => {});
}

export function notifyMeetingLinkSent(params: {
  userId: string | null;
  clientEmail: string;
  bookingId: string;
  bookingNumber: string;
}): void {
  void (async () => {
    const userId = params.userId ?? (await resolveUserIdByEmail(params.clientEmail));
    if (!userId) return;
    await createClientNotification({
      userId,
      type: "MEETING_LINK_SENT",
      title: "Meeting link ready",
      message: `Your consultation link for #${params.bookingNumber} is ready.`,
      link: `/account/consultations`,
      entityId: params.bookingId,
    });
  })().catch(() => {});
}

export function notifyMoodboardReady(params: {
  userId: string | null;
  clientEmail: string;
  bookingId: string;
  bookingNumber: string;
}): void {
  void (async () => {
    const userId = params.userId ?? (await resolveUserIdByEmail(params.clientEmail));
    if (!userId) return;
    await createClientNotification({
      userId,
      type: "MOODBOARD_READY",
      title: "Your moodboard is ready",
      message: `Session materials for #${params.bookingNumber} are available in your account.`,
      link: `/account/consultations`,
      entityId: params.bookingId,
    });
  })().catch(() => {});
}

export function notifyInvoiceIssued(params: {
  clientEmail: string;
  invoiceId: string;
  invoiceNumber: string;
  publicToken: string;
}): void {
  void (async () => {
    const userId = await resolveUserIdByEmail(params.clientEmail);
    if (!userId) return;
    await createClientNotification({
      userId,
      type: "INVOICE_ISSUED",
      title: "Invoice ready",
      message: `Invoice ${params.invoiceNumber} is ready for your review.`,
      link: `/invoice/${params.publicToken}`,
      entityId: params.invoiceId,
    });
  })().catch(() => {});
}

export function notifyQuoteReady(params: {
  clientEmail: string;
  quoteId: string;
  quoteRef: string;
  approvalToken: string;
}): void {
  void (async () => {
    const userId = await resolveUserIdByEmail(params.clientEmail);
    if (!userId) return;
    await createClientNotification({
      userId,
      type: "QUOTE_READY",
      title: "Quotation ready",
      message: `Quotation ${params.quoteRef} is ready for your approval.`,
      link: `/quote/${params.approvalToken}`,
      entityId: params.quoteId,
    });
  })().catch(() => {});
}

export function notifyPaymentConfirmed(params: {
  userId: string | null;
  clientEmail: string;
  ref: string;
  link: string;
  entityId: string;
}): void {
  void (async () => {
    const userId = params.userId ?? (await resolveUserIdByEmail(params.clientEmail));
    if (!userId) return;
    await createClientNotification({
      userId,
      type: "PAYMENT_CONFIRMED",
      title: "Payment confirmed",
      message: `We've received your payment for ${params.ref}.`,
      link: params.link,
      entityId: params.entityId,
    });
  })().catch(() => {});
}

export function notifyBalanceReminder(params: {
  clientProfileId: string | null;
  clientEmail: string;
  orderId: string;
  orderRef: string;
  trackingToken: string;
  balanceNGN: number;
}): void {
  void (async () => {
    const userId = await resolveUserIdForBespoke(params.clientProfileId, params.clientEmail);
    if (!userId) return;
    await createClientNotification({
      userId,
      type: "BALANCE_REMINDER",
      title: "Outstanding balance reminder",
      message: `${params.orderRef} — ₦${Math.round(params.balanceNGN).toLocaleString("en-NG")} outstanding before delivery.`,
      link: `/track/${params.trackingToken}`,
      entityId: params.orderId,
    });
  })().catch(() => {});
}

export function notifyEventReminder(params: {
  userId: string;
  eventId: string;
  eventLabel: string;
}): void {
  void createClientNotification({
    userId: params.userId,
    type: "EVENT_REMINDER",
    title: `${params.eventLabel} is coming up`,
    message: "It's a great time to begin your commission or browse our collection.",
    link: "/consultation",
    entityId: params.eventId,
  }).catch(() => {});
}

export async function hasRecentBalanceReminder(orderId: string, withinDays = 7): Promise<boolean> {
  const since = new Date(Date.now() - withinDays * 24 * 60 * 60 * 1000);
  const existing = await prisma.customerNotification.findFirst({
    where: {
      entityId: orderId,
      type: "PAYMENT",
      title: "Outstanding balance reminder",
      createdAt: { gte: since },
    },
    select: { id: true },
  });
  return Boolean(existing);
}
