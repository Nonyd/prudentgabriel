import type { BespokeStage, CustomerNotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { STAGE_SHORT_LABELS } from "@/lib/bespoke-stages";

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

/** Spec alias — stores granular CustomerNotificationType directly. */
export async function createClientNotification(params: {
  userId: string;
  type: CustomerNotificationType;
  title: string;
  message: string;
  link?: string;
  entityId?: string;
}): Promise<void> {
  await createCustomerNotification(params);
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

export function notifyBankTransferConfirmed(params: {
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
      type: "BANK_TRANSFER_CONFIRMED",
      title: "Bank transfer confirmed",
      message: `Your bank transfer for ${params.ref} has been confirmed.`,
      link: params.link,
      entityId: params.entityId,
    });
  })().catch(() => {});
}

export function notifyOrderConfirmed(params: {
  userId: string;
  orderId: string;
  orderNumber: string;
}): void {
  void createClientNotification({
    userId: params.userId,
    type: "ORDER_CONFIRMED",
    title: "Order confirmed",
    message: `Your order #${params.orderNumber} is confirmed.`,
    link: "/account/orders",
    entityId: params.orderId,
  }).catch(() => {});
}

export function notifyOrderShipped(params: {
  userId: string;
  orderId: string;
  orderNumber: string;
}): void {
  void createClientNotification({
    userId: params.userId,
    type: "ORDER_SHIPPED",
    title: "Your order has shipped",
    message: `Order #${params.orderNumber} is on its way.`,
    link: "/account/orders",
    entityId: params.orderId,
  }).catch(() => {});
}

export function notifyOrderDelivered(params: {
  userId: string;
  orderId: string;
  orderNumber: string;
}): void {
  void createClientNotification({
    userId: params.userId,
    type: "ORDER_DELIVERED",
    title: "Order delivered",
    message: `Order #${params.orderNumber} has been delivered.`,
    link: "/account/orders",
    entityId: params.orderId,
  }).catch(() => {});
}

export function notifyReviewRequest(params: {
  userId: string;
  orderId: string;
  productName: string;
}): void {
  void createClientNotification({
    userId: params.userId,
    type: "REVIEW_REQUEST",
    title: "Share your thoughts",
    message: `How was your ${params.productName}? Leave a quick review.`,
    link: "/account/orders",
    entityId: params.orderId,
  }).catch(() => {});
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
      type: "BALANCE_REMINDER",
      createdAt: { gte: since },
    },
    select: { id: true },
  });
  return Boolean(existing);
}
