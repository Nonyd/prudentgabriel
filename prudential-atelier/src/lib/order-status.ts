import type { OrderStatus } from "@prisma/client";

const EDGES: [OrderStatus, OrderStatus][] = [
  ["PENDING", "CONFIRMED"],
  ["CONFIRMED", "PROCESSING"],
  ["PROCESSING", "SHIPPED"],
  ["SHIPPED", "DELIVERED"],
];

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return true;
  if (to === "CANCELLED" || to === "REFUNDED") return true;
  return EDGES.some(([a, b]) => a === from && b === to);
}
