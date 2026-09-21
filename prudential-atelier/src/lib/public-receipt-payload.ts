import { OrderStatus } from "@prisma/client";
import {
  alterationWindowClosesAt,
  getAlterationWarrantyDays,
  isAlterationWindowOpen,
} from "@/lib/alterations/policy";
import { findOrderByReceiptToken } from "@/lib/capability-token-lookup";

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

export async function loadPublicReceipt(
  token: string,
): Promise<
  | { ok: true; payload: PublicReceiptPayload }
  | { ok: false; reason: "missing" | "expired" }
> {
  const found = await findOrderByReceiptToken(token);
  if (!found.ok) return { ok: false, reason: found.reason };

  const order = found.order;
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
  return { ok: true, payload };
}
