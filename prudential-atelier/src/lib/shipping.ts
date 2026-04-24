import { prisma } from "@/lib/prisma";

export interface AddressForShipping {
  city: string;
  state: string;
  country: string;
}

export interface ShippingOption {
  zoneId: string;
  zoneName: string;
  costNGN: number;
  isFree: boolean;
  estimatedDays: string;
}

function zoneMatches(
  zone: { countries: string[]; states: string[] },
  address: AddressForShipping,
): boolean {
  const { countries, states } = zone;
  if (countries.includes("*")) return true;
  if (!countries.includes(address.country)) return false;
  if (states.length === 0) return true;
  return states.includes(address.state);
}

export async function calculateShippingOptions(
  address: AddressForShipping,
  subtotalNGN: number,
  totalWeightKg: number,
  isFreeShippingCoupon: boolean,
): Promise<ShippingOption[]> {
  const zones = await prisma.shippingZone.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  const matched: ShippingOption[] = [];

  for (const zone of zones) {
    if (!zoneMatches(zone, address)) continue;

    const baseCost = zone.flatRateNGN + zone.perKgNGN * totalWeightKg;
    const isFree =
      isFreeShippingCoupon ||
      (zone.freeAboveNGN != null && subtotalNGN >= zone.freeAboveNGN);
    const finalCost = isFree ? 0 : baseCost;

    matched.push({
      zoneId: zone.id,
      zoneName: zone.name,
      costNGN: finalCost,
      isFree,
      estimatedDays: zone.estimatedDays,
    });
  }

  matched.sort((a, b) => {
    if (a.isFree !== b.isFree) return a.isFree ? -1 : 1;
    return a.costNGN - b.costNGN;
  });

  if (matched.length === 0) {
    return [
      {
        zoneId: "manual",
        zoneName: "Custom Quote",
        costNGN: 0,
        isFree: false,
        estimatedDays: "Contact us",
      },
    ];
  }

  return matched;
}
