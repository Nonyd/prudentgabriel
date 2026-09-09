import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  alterationWindowClosesAt,
  getAlterationWarrantyDays,
  isAlterationWindowOpen,
} from "@/lib/alterations/policy";

/** Public receipt DTO — the commission, delivery, window. No client record. */
export type PublicReceiptPayload = {
  orderRef: string;
  deliveredAt: string | null;
  receiptConfirmedAt: string | null;
  warrantyEndsAt: string | null;
  warrantyDays: number;
  windowOpen: boolean;
  archived: boolean;
};

export function publicReceiptOmitsClientRecord(payload: Record<string, unknown>): boolean {
  const forbidden = [
    "clientEmail",
    "clientPhone",
    "clientAddress",
    "clientCity",
    "clientInstagram",
    "clientCountry",
    "clientName",
    "addresseeName",
  ];
  return forbidden.every((key) => !(key in payload) || payload[key] == null);
}

export async function loadPublicReceipt(token: string): Promise<PublicReceiptPayload | null> {
  const order = await prisma.bespokeOrder.findUnique({
    where: { receiptConfirmToken: token },
    select: {
      orderRef: true,
      status: true,
      deliveredAt: true,
      receiptConfirmedAt: true,
    },
  });
  if (!order) return null;

  const warrantyDays = await getAlterationWarrantyDays();
  const warrantyEndsAt = order.receiptConfirmedAt
    ? alterationWindowClosesAt(order.receiptConfirmedAt, warrantyDays)
    : null;
  const windowOpen = isAlterationWindowOpen({
    receiptConfirmedAt: order.receiptConfirmedAt,
    warrantyDays,
  });

  const payload: PublicReceiptPayload = {
    orderRef: order.orderRef,
    deliveredAt: order.deliveredAt?.toISOString() ?? null,
    receiptConfirmedAt: order.receiptConfirmedAt?.toISOString() ?? null,
    warrantyEndsAt: warrantyEndsAt?.toISOString() ?? null,
    warrantyDays,
    windowOpen,
    archived: order.status === OrderStatus.ARCHIVED,
  };
  return payload;
}
