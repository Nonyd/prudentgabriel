import { ShippingMethodKind, ShippingQuoteStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveDestinationBand, type DestinationInput } from "@/lib/shipping/destination";
import { rateWithTimeout } from "@/lib/shipping/rate";
import { billableKgForCarrier, combineParcels, mergeParcel, type ParcelDims } from "@/lib/shipping/weight";
import { getShippingCopy } from "@/lib/shipping/copy";
import type { RateRequest } from "@/lib/shipping/carriers/types";

export type CheckoutShippingOption = {
  optionId: string;
  kind: ShippingMethodKind | "QUOTE_PENDING";
  name: string;
  description?: string;
  costNGN: number;
  isFree: boolean;
  etaText: string;
  requiresConsent: boolean;
  requiresAddress: boolean;
  pickupLocationId?: string;
  lagosLocationId?: string;
  methodId?: string;
};

export type CartParcelLine = {
  quantity: number;
  variant?: Partial<ParcelDims> | null;
  product?: Partial<ParcelDims> | null;
};

/** GIG: actual kg. DHL: max(actual, L×W×H/5000). Never share one billable across carriers. */
export function carrierRateRequest(
  parcel: ParcelDims,
  destination: DestinationInput,
  declaredValueNGN: number,
  carrier: "gig" | "dhl",
): RateRequest {
  return {
    destination: {
      country: destination.country,
      state: destination.state ?? "",
      city: destination.city ?? "",
    },
    actualKg: parcel.weightKg,
    billableKg: billableKgForCarrier(parcel, carrier),
    lengthCm: parcel.lengthCm,
    widthCm: parcel.widthCm,
    heightCm: parcel.heightCm,
    declaredValueNGN,
  };
}

export async function parcelForCart(lines: CartParcelLine[]): Promise<{ parcel: ParcelDims }> {
  const pack = await prisma.packagingProfile.findFirst({
    where: { isDefault: true },
    orderBy: { createdAt: "asc" },
  });
  const parcels = lines.map((line) =>
    mergeParcel({
      variant: line.variant,
      product: line.product,
      packaging: pack,
      quantity: line.quantity,
    }),
  );
  return { parcel: combineParcels(parcels) };
}

export async function listCheckoutShippingOptions(params: {
  destination: DestinationInput;
  subtotalNGN: number;
  lines: CartParcelLine[];
  isFreeShippingCoupon: boolean;
}): Promise<{ band: ReturnType<typeof resolveDestinationBand>; options: CheckoutShippingOption[]; quoteConsent: string }> {
  const band = resolveDestinationBand(params.destination);
  const { quoteConsent } = await getShippingCopy();
  const methods = await prisma.shippingMethod.findMany({
    where: { isActive: true },
    include: {
      pickupLocations: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
      lagosLocations: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
    },
    orderBy: { sortOrder: "asc" },
  });

  const pickup = methods.find((m) => m.kind === "PICKUP");
  const local = methods.find((m) => m.kind === "LOCAL_FLAT");
  const gig = methods.find((m) => m.kind === "CARRIER_GIG");
  const dhl = methods.find((m) => m.kind === "CARRIER_DHL");

  const options: CheckoutShippingOption[] = [];

  if (band === "LAGOS") {
    if (pickup) {
      for (const loc of pickup.pickupLocations) {
        options.push({
          optionId: `pickup:${loc.id}`,
          kind: "PICKUP",
          name: loc.name,
          description: loc.hours,
          costNGN: 0,
          isFree: true,
          etaText: "Collect when ready",
          requiresConsent: false,
          requiresAddress: false,
          pickupLocationId: loc.id,
          methodId: pickup.id,
        });
      }
    }
    if (local) {
      for (const loc of local.lagosLocations) {
        const free =
          params.isFreeShippingCoupon ||
          (loc.freeAboveNGN != null && params.subtotalNGN >= loc.freeAboveNGN);
        options.push({
          optionId: `lagos:${loc.id}`,
          kind: "LOCAL_FLAT",
          name: loc.name,
          costNGN: free ? 0 : loc.price,
          isFree: free,
          etaText: loc.etaText,
          requiresConsent: false,
          requiresAddress: true,
          lagosLocationId: loc.id,
          methodId: local.id,
        });
      }
    }
    return { band, options, quoteConsent };
  }

  const { parcel } = await parcelForCart(params.lines);

  if (band === "NIGERIA" && gig) {
    const rated = await rateWithTimeout("gig", carrierRateRequest(parcel, params.destination, params.subtotalNGN, "gig"), gig);
    if (rated.ok) {
      options.push({
        optionId: `carrier:gig:${gig.id}`,
        kind: "CARRIER_GIG",
        name: gig.name,
        description: gig.description ?? undefined,
        costNGN: params.isFreeShippingCoupon ? 0 : rated.amountNGN,
        isFree: params.isFreeShippingCoupon,
        etaText: rated.etaText,
        requiresConsent: false,
        requiresAddress: true,
        methodId: gig.id,
      });
    } else {
      options.push(quotePendingOption(gig.id, gig.name, quoteConsent, "CARRIER_GIG"));
    }
    return { band, options, quoteConsent };
  }

  if (band === "INTERNATIONAL" && dhl) {
    const rated = await rateWithTimeout("dhl", carrierRateRequest(parcel, params.destination, params.subtotalNGN, "dhl"), dhl);
    if (rated.ok) {
      options.push({
        optionId: `carrier:dhl:${dhl.id}`,
        kind: "CARRIER_DHL",
        name: dhl.name,
        description: dhl.description ?? undefined,
        costNGN: params.isFreeShippingCoupon ? 0 : rated.amountNGN,
        isFree: params.isFreeShippingCoupon,
        etaText: rated.etaText,
        requiresConsent: false,
        requiresAddress: true,
        methodId: dhl.id,
      });
    } else {
      options.push(quotePendingOption(dhl.id, dhl.name, quoteConsent, "CARRIER_DHL"));
    }
    return { band, options, quoteConsent };
  }

  options.push({
    optionId: "quote:manual",
    kind: "QUOTE_PENDING",
    name: "We'll confirm shipping",
    description: quoteConsent,
    costNGN: 0,
    isFree: false,
    etaText: "Quoted within one business day",
    requiresConsent: true,
    requiresAddress: true,
  });
  return { band, options, quoteConsent };
}

function quotePendingOption(
  methodId: string,
  name: string,
  consent: string,
  kind: "CARRIER_GIG" | "CARRIER_DHL",
): CheckoutShippingOption {
  return {
    optionId: `quote:${kind === "CARRIER_DHL" ? "dhl" : "gig"}:${methodId}`,
    kind: "QUOTE_PENDING",
    name: `${name} — we'll confirm the rate`,
    description: consent,
    costNGN: 0,
    isFree: false,
    etaText: "Quoted within one business day",
    requiresConsent: true,
    requiresAddress: true,
    methodId,
  };
}

export function parseShippingOptionId(optionId: string): {
  type: "pickup" | "lagos" | "carrier" | "quote";
  id?: string;
  carrier?: "gig" | "dhl";
} {
  const [type, a, b] = optionId.split(":");
  if (type === "pickup") return { type: "pickup", id: a };
  if (type === "lagos") return { type: "lagos", id: a };
  if (type === "carrier") return { type: "carrier", carrier: a as "gig" | "dhl", id: b };
  return { type: "quote", carrier: a === "gig" || a === "dhl" ? a : undefined, id: b ?? a };
}

export { ShippingQuoteStatus };
