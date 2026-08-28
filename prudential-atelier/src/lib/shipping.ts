import { listCheckoutShippingOptions, type CartParcelLine, type CheckoutShippingOption } from "@/lib/shipping/options";
import type { AddressForShipping, ShippingOption } from "@/lib/shipping/legacy";

export type { AddressForShipping, ShippingOption } from "@/lib/shipping/legacy";
export type { CheckoutShippingOption, CartParcelLine } from "@/lib/shipping/options";
export { listCheckoutShippingOptions, parseShippingOptionId, parcelForCart } from "@/lib/shipping/options";

/** Back-compat wrapper used by older callers that still speak zoneId. */
export async function calculateShippingOptions(
  address: AddressForShipping,
  subtotalNGN: number,
  _totalWeightKg: number,
  isFreeShippingCoupon: boolean,
  lines: CartParcelLine[] = [],
): Promise<ShippingOption[]> {
  const { options } = await listCheckoutShippingOptions({
    destination: address,
    subtotalNGN,
    lines,
    isFreeShippingCoupon,
  });
  return options.map(toLegacyOption);
}

function toLegacyOption(o: CheckoutShippingOption): ShippingOption {
  return {
    zoneId: o.optionId,
    zoneName: o.name,
    costNGN: o.costNGN,
    isFree: o.isFree,
    estimatedDays: o.etaText,
  };
}
