import type { OrderStatus, ShippingMethodKind } from "@prisma/client";
import { rtwHasOutstandingBalance } from "@/lib/payments/rtw-totals";

const DELIVERY_EDGES: [OrderStatus, OrderStatus][] = [
  ["PENDING", "CONFIRMED"],
  ["CONFIRMED", "PROCESSING"],
  ["PROCESSING", "SHIPPED"],
  ["SHIPPED", "DELIVERED"],
];

const PICKUP_EDGES: [OrderStatus, OrderStatus][] = [
  ["PENDING", "CONFIRMED"],
  ["CONFIRMED", "PROCESSING"],
  ["PROCESSING", "READY_FOR_COLLECTION"],
  ["READY_FOR_COLLECTION", "COLLECTED"],
];

export function isPickupFulfilment(kind: ShippingMethodKind | string | null | undefined): boolean {
  return kind === "PICKUP";
}

export function canTransitionOrder(
  from: OrderStatus,
  to: OrderStatus,
  opts?: { kind?: ShippingMethodKind | string | null },
): boolean {
  if (from === to) return true;
  if (to === "CANCELLED" || to === "REFUNDED") return true;
  const edges = isPickupFulfilment(opts?.kind) ? PICKUP_EDGES : DELIVERY_EDGES;
  return edges.some(([a, b]) => a === from && b === to);
}

export function shippingRequiresTracking(kind: ShippingMethodKind | string | null | undefined): boolean {
  return !isPickupFulfilment(kind);
}

export function assertCanMarkShipped(order: {
  status: OrderStatus;
  shippingMethodKind?: ShippingMethodKind | string | null;
  balance?: number | null;
  amountPaid?: number | null;
  total: number;
  trackingNumber?: string | null;
}): { ok: true } | { ok: false; error: string } {
  if (rtwHasOutstandingBalance(order)) {
    return { ok: false, error: "Cannot mark shipped while a balance is outstanding" };
  }
  if (isPickupFulfilment(order.shippingMethodKind)) {
    return { ok: false, error: "Pickup orders are marked ready for collection, not shipped" };
  }
  return { ok: true };
}

export function assertCanMarkReadyForCollection(order: {
  shippingMethodKind?: ShippingMethodKind | string | null;
  balance?: number | null;
  amountPaid?: number | null;
  total: number;
}): { ok: true } | { ok: false; error: string } {
  if (!isPickupFulfilment(order.shippingMethodKind)) {
    return { ok: false, error: "Only pickup orders can be marked ready for collection" };
  }
  if (rtwHasOutstandingBalance(order)) {
    return { ok: false, error: "Cannot release for collection while a balance is outstanding" };
  }
  return { ok: true };
}
