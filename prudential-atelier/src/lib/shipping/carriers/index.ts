import { createDhlCarrier } from "@/lib/shipping/carriers/dhl";
import { createGigCarrier } from "@/lib/shipping/carriers/gig";
import type { ShippingCarrier } from "@/lib/shipping/carriers/types";

export type { RateError, RateRequest, RateResult, ShippingCarrier } from "@/lib/shipping/carriers/types";
export { CARRIER_TIMEOUT_MS, QUOTE_CACHE_TTL_MS } from "@/lib/shipping/carriers/types";

let testCarriers: ShippingCarrier[] | null = null;

export function setShippingCarriersForTest(carriers: ShippingCarrier[] | null): void {
  testCarriers = carriers;
}

export function injectedShippingCarriersForTest(): ShippingCarrier[] | null {
  return testCarriers;
}

export function listShippingCarriers(): ShippingCarrier[] {
  if (testCarriers) return testCarriers;
  return [createGigCarrier(), createDhlCarrier()];
}

export function getCarrier(name: "gig" | "dhl"): ShippingCarrier {
  const found = listShippingCarriers().find((c) => c.name === name);
  if (found) return found;
  return name === "gig" ? createGigCarrier() : createDhlCarrier();
}
