import { FabricUnavailableChoice, type Prisma } from "@prisma/client";

export const FABRIC_UNAVAILABLE_ATTENTION = "fabric-unavailable";
/** AR5: live setting `fabric_promise_hours` (read in fabric-promise.ts, server only); this is the fallback. */
export const DEFAULT_FABRIC_PROMISE_HOURS = 48;
export const FABRIC_PROMISE_HOURS_KEY = "fabric_promise_hours";

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

export function fabricQueueOverdue(at: Date, promiseHours: number, now = new Date()): boolean {
  return hoursOnFabricQueue(at, now) > promiseHours;
}
