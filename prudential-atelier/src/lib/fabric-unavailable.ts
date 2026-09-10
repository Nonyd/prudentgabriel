import { FabricUnavailableChoice, type Prisma } from "@prisma/client";

export const FABRIC_UNAVAILABLE_ATTENTION = "fabric-unavailable";
export const FABRIC_PROMISE_HOURS = 48;

export const FABRIC_CHOICE_LABEL: Record<FabricUnavailableChoice, string> = {
  ALTERNATIVE_OFFERED: "Alternative offered",
  REFUNDED: "Refunded",
};

export function isFabricUnavailableChoice(value: string): value is FabricUnavailableChoice {
  return value === "ALTERNATIVE_OFFERED" || value === "REFUNDED";
}

export function fabricQueueWhere(): Prisma.OrderWhereInput {
  return {
    fabricUnavailableAt: { not: null },
    refundRecordedAt: null,
  };
}

export function hoursOnFabricQueue(at: Date, now = new Date()): number {
  return Math.max(0, (now.getTime() - at.getTime()) / 36e5);
}

export function fabricQueueOverdue(at: Date, now = new Date()): boolean {
  return hoursOnFabricQueue(at, now) > FABRIC_PROMISE_HOURS;
}
