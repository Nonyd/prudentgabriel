import { ShippingMethodKind, ShippingQuoteStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  carrierRateRequest,
  listCheckoutShippingOptions,
  parcelForCart,
  parseShippingOptionId,
  type CartParcelLine,
} from "@/lib/shipping/options";
import { rateWithTimeout } from "@/lib/shipping/rate";
import type { DestinationInput } from "@/lib/shipping/destination";
import { getShippingCopy } from "@/lib/shipping/copy";
import { getShippingBandModes } from "@/lib/shipping/mode";

export type ResolvedShipping = {
  optionId: string;
  methodId: string | null;
  kind: ShippingMethodKind | null;
  lagosLocationId: string | null;
  pickupLocationId: string | null;
  shippingAmount: number;
  quoteStatus: ShippingQuoteStatus;
  quoteLocked: Record<string, unknown> | null;
  requiresConsent: boolean;
  requiresAddress: boolean;
  consentText: string;
  etaText: string;
  name: string;
};

export async function resolveCheckoutShipping(params: {
  optionId: string;
  destination: DestinationInput;
  subtotalNGN: number;
  lines: CartParcelLine[];
  isFreeShippingCoupon: boolean;
}): Promise<{ ok: true; shipping: ResolvedShipping } | { ok: false; error: string }> {
  const { options } = await listCheckoutShippingOptions({
    destination: params.destination,
    subtotalNGN: params.subtotalNGN,
    lines: params.lines,
    isFreeShippingCoupon: params.isFreeShippingCoupon,
  });
  const selected = options.find((o) => o.optionId === params.optionId);
  if (!selected) {
    return { ok: false, error: "Invalid shipping method for this destination" };
  }

  const parsed = parseShippingOptionId(selected.optionId);
  let amount = selected.costNGN;
  let quoteLocked: Record<string, unknown> | null = null;
  let quoteStatus: ShippingQuoteStatus = ShippingQuoteStatus.NONE;
  const modes = await getShippingBandModes();

  if (selected.kind === "QUOTE_PENDING") {
    quoteStatus = ShippingQuoteStatus.QUOTE_PENDING;
    amount = 0;
    const reason = selected.quoteReason ?? "unavailable";
    quoteLocked = {
      pending: true,
      carrier: parsed.carrier ?? "manual",
      mode: reason === "manual" ? "MANUAL" : "LIVE_FALLBACK",
      quotedAt: new Date().toISOString(),
    };
  } else if (parsed.type === "carrier" && parsed.carrier && selected.methodId) {
    const method = await prisma.shippingMethod.findUnique({ where: { id: selected.methodId } });
    const { parcel } = await parcelForCart(params.lines);
    const rateReq = carrierRateRequest(parcel, params.destination, params.subtotalNGN, parsed.carrier);
    const rated = await rateWithTimeout(parsed.carrier, rateReq, method);
    if (!rated.ok) {
      quoteStatus = ShippingQuoteStatus.QUOTE_PENDING;
      amount = 0;
      quoteLocked = {
        pending: true,
        carrier: parsed.carrier,
        mode: "LIVE_FALLBACK",
        reason: rated.kind,
        quotedAt: new Date().toISOString(),
      };
    } else {
      amount = params.isFreeShippingCoupon ? 0 : rated.amountNGN;
      quoteLocked = {
        amountNGN: amount,
        carrier: parsed.carrier,
        service: rated.service,
        billableKg: rateReq.billableKg,
        quotedAt: new Date().toISOString(),
      };
    }
  } else if (parsed.type === "lagos" || parsed.type === "pickup") {
    quoteLocked = {
      amountNGN: amount,
      kind: selected.kind,
      quotedAt: new Date().toISOString(),
    };
  }

  const copy = await getShippingCopy();
  const consentFromOption =
    selected.kind === "QUOTE_PENDING" ? selected.description?.trim() : undefined;
  const fallbackConsent =
    selected.quoteReason === "manual" ||
    (parsed.carrier === "gig" && modes.nigeria === "MANUAL") ||
    (parsed.carrier === "dhl" && modes.international === "MANUAL")
      ? copy.manualConsent
      : copy.unavailableConsent;

  return {
    ok: true,
    shipping: {
      optionId: selected.optionId,
      methodId: selected.methodId ?? null,
      kind: selected.kind === "QUOTE_PENDING" ? (parsed.carrier === "dhl" ? "CARRIER_DHL" : parsed.carrier === "gig" ? "CARRIER_GIG" : null) : selected.kind,
      lagosLocationId: selected.lagosLocationId ?? null,
      pickupLocationId: selected.pickupLocationId ?? null,
      shippingAmount: amount,
      quoteStatus,
      quoteLocked,
      requiresConsent: selected.requiresConsent || quoteStatus === ShippingQuoteStatus.QUOTE_PENDING,
      requiresAddress: selected.requiresAddress,
      consentText: consentFromOption || fallbackConsent,
      etaText: selected.etaText,
      name: selected.name,
    },
  };
}
