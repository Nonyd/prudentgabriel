import { ShippingMethodKind, ShippingQuoteStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { listCheckoutShippingOptions, parseShippingOptionId, type CartParcelLine } from "@/lib/shipping/options";
import { rateWithTimeout } from "@/lib/shipping/rate";
import { parcelForCart } from "@/lib/shipping/options";
import type { DestinationInput } from "@/lib/shipping/destination";
import { getShippingCopy } from "@/lib/shipping/copy";

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
  const { options, quoteConsent } = await listCheckoutShippingOptions({
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

  if (selected.kind === "QUOTE_PENDING") {
    quoteStatus = ShippingQuoteStatus.QUOTE_PENDING;
    amount = 0;
    quoteLocked = { pending: true, carrier: parsed.carrier ?? "manual", quotedAt: new Date().toISOString() };
  } else if (parsed.type === "carrier" && parsed.carrier && selected.methodId) {
    const method = await prisma.shippingMethod.findUnique({ where: { id: selected.methodId } });
    const { parcel, billable } = await parcelForCart(params.lines);
    const rated = await rateWithTimeout(
      parsed.carrier,
      {
        destination: {
          country: params.destination.country,
          state: params.destination.state ?? "",
          city: params.destination.city ?? "",
        },
        actualKg: parcel.weightKg,
        billableKg: billable,
        lengthCm: parcel.lengthCm,
        widthCm: parcel.widthCm,
        heightCm: parcel.heightCm,
        declaredValueNGN: params.subtotalNGN,
      },
      method,
    );
    if (!rated.ok) {
      quoteStatus = ShippingQuoteStatus.QUOTE_PENDING;
      amount = 0;
      quoteLocked = { pending: true, carrier: parsed.carrier, reason: rated.kind, quotedAt: new Date().toISOString() };
    } else {
      amount = params.isFreeShippingCoupon ? 0 : rated.amountNGN;
      quoteLocked = {
        amountNGN: amount,
        carrier: parsed.carrier,
        service: rated.service,
        billableKg: billable,
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

  const { quoteConsent: cmsConsent } = await getShippingCopy();

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
      consentText: cmsConsent,
      etaText: selected.etaText,
      name: selected.name,
    },
  };
}
