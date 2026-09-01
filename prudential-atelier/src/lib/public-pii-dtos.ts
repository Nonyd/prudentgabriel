import type { BespokeStage, ConsultationStatus, OrderStatus, PaymentStatus } from "@prisma/client";

export function clientFirstName(fullName: string): string {
  const part = fullName.trim().split(/\s+/)[0];
  return part || "Client";
}

export type PublicTrackDto = {
  orderRef: string;
  status: OrderStatus;
  currentStage: BespokeStage;
  clientFirstName: string;
  expectedDelivery: string | null;
};

export function toPublicTrackDto(order: {
  orderRef: string;
  status: OrderStatus;
  currentStage: BespokeStage;
  clientName: string;
  deliveryDate: Date | null;
}): PublicTrackDto {
  return {
    orderRef: order.orderRef,
    status: order.status,
    currentStage: order.currentStage,
    clientFirstName: clientFirstName(order.clientName),
    expectedDelivery: order.deliveryDate ? order.deliveryDate.toISOString() : null,
  };
}

export type PublicConsultationDto = {
  bookingNumber: string;
  status: ConsultationStatus;
  paymentStatus: PaymentStatus;
  clientFirstName: string;
  offeringName: string | null;
  consultantName: string | null;
  confirmedDate: string | null;
  confirmedTime: string | null;
};

export function toPublicConsultationDto(booking: {
  bookingNumber: string;
  status: ConsultationStatus;
  paymentStatus: PaymentStatus;
  clientName: string;
  confirmedDate: Date | null;
  confirmedTime: string | null;
  offering?: { sessionType?: string | null } | null;
  consultant?: { name?: string | null } | null;
}): PublicConsultationDto {
  return {
    bookingNumber: booking.bookingNumber,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    clientFirstName: clientFirstName(booking.clientName),
    offeringName: booking.offering?.sessionType ?? null,
    consultantName: booking.consultant?.name ?? null,
    confirmedDate: booking.confirmedDate ? booking.confirmedDate.toISOString() : null,
    confirmedTime: booking.confirmedTime,
  };
}

export type PublicRtwOrderDto = {
  orderNumber: string;
  status: string;
  paymentStatus: PaymentStatus;
  subtotal: number;
  shippingAmount: number;
  discount: number;
  pointsDiscountNGN: number;
  total: number;
  paymentRef: string | null;
  currency: string;
  fxRateLocked: number | null;
  collectionCode: string | null;
  shippingZone: { name: string; estimatedDays: string | null } | null;
  items: {
    name: string;
    size: string | null;
    sizeMode?: string;
    quantity: number;
    lineTotal: number;
  }[];
};

export function toPublicRtwOrderDto(order: {
  orderNumber: string;
  status: string;
  paymentStatus: PaymentStatus;
  subtotal: number;
  shippingAmount: number;
  discount: number;
  pointsDiscountNGN: number;
  total: number;
  paymentRef?: string | null;
  currency?: string;
  fxRateLocked?: number | null;
  collectionCode?: string | null;
  shippingZone: { name: string; estimatedDays: string | null } | null;
  items: {
    product: { name: string };
    size: string | null;
    sizeMode?: string | null;
    quantity: number;
    lineTotal: number;
  }[];
}): PublicRtwOrderDto {
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    subtotal: order.subtotal,
    shippingAmount: order.shippingAmount,
    discount: order.discount,
    pointsDiscountNGN: order.pointsDiscountNGN,
    total: order.total,
    paymentRef: order.paymentRef ?? null,
    currency: order.currency ?? "NGN",
    fxRateLocked: order.fxRateLocked ?? null,
    collectionCode: order.collectionCode ?? null,
    shippingZone: order.shippingZone,
    items: order.items.map((i) => ({
      name: i.product.name,
      size: i.sizeMode === "CUSTOM" ? "Made to your measurements" : i.size,
      sizeMode: i.sizeMode ?? "STANDARD",
      quantity: i.quantity,
      lineTotal: i.lineTotal,
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
