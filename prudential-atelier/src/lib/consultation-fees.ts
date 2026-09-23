import type { PaymentGateway } from "@prisma/client";
import { convertFromNGN, getExchangeRates, type ShopCurrency } from "@/lib/currency";
import { expectedAmountInPspUnits } from "@/lib/payment-bind";
import { convertAtLockedRate, getLockedFx, lockedFxFromOrder, persistableFxFields, roundMoney, type LockedFx } from "@/lib/fx";
import { getSetting } from "@/lib/settings";
import { OFFERING_TYPES, type OfferingTypeKey } from "@/lib/consultation-types";

/**
 * Slice BA3 — consultation fees are four editable settings (PAYMENTS group,
 * beside alteration_warranty_days), one per type. The invitation page, the
 * charge and the booking all read them through here.
 *
 * A booking freezes its fee (ConsultationBooking.feeNGN) and, for USD/GBP, the
 * rate and exact foreign amount (fxAmountLocked). Changing a setting never
 * alters a booking already made, and the figure shown is the figure charged.
 */

export const CONSULTATION_FEE_KEYS: Record<OfferingTypeKey, string> = {
  PHYSICAL_PRUDENT_TEAM: "consultation_fee_physical_prudent",
  PHYSICAL_TEAM_ONLY: "consultation_fee_physical_team",
  VIRTUAL_PRUDENT_TEAM: "consultation_fee_virtual_prudent",
  VIRTUAL_TEAM_ONLY: "consultation_fee_virtual_team",
};

/** As set at the 22 September meeting. Seeded into the settings; used only if a row is missing or invalid. */
export const DEFAULT_CONSULTATION_FEES_NGN: Record<OfferingTypeKey, number> = {
  PHYSICAL_PRUDENT_TEAM: 250_000,
  PHYSICAL_TEAM_ONLY: 200_000,
  VIRTUAL_PRUDENT_TEAM: 200_000,
  VIRTUAL_TEAM_ONLY: 180_000,
};

export async function getConsultationFeeNGN(key: OfferingTypeKey): Promise<number> {
  const n = Number(await getSetting(CONSULTATION_FEE_KEYS[key]));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : DEFAULT_CONSULTATION_FEES_NGN[key];
}

export type ChargeCurrency = "NGN" | "USD" | "GBP";

export function asChargeCurrency(c: string | null | undefined): ChargeCurrency {
  const u = (c ?? "NGN").trim().toUpperCase();
  return u === "USD" || u === "GBP" ? u : "NGN";
}

/** The one conversion: naira fee → the amount charged in `currency` at `fx`, to the cent. */
export function consultationChargeAt(feeNGN: number, currency: ChargeCurrency, fx: LockedFx): number {
  if (currency === "NGN") return feeNGN;
  return roundMoney(convertAtLockedRate(feeNGN, currency, fx));
}

export type ConsultationFeeQuote = Record<ChargeCurrency, number>;

/** What the invitation page shows, per type and currency, at the rate a booking made now would lock. */
export async function quoteConsultationFees(): Promise<{ fees: Record<OfferingTypeKey, ConsultationFeeQuote> }> {
  const fx = await getLockedFx();
  const entries = await Promise.all(
    OFFERING_TYPES.map(async (key) => {
      const ngn = await getConsultationFeeNGN(key);
      return [key, { NGN: ngn, USD: consultationChargeAt(ngn, "USD", fx), GBP: consultationChargeAt(ngn, "GBP", fx) }] as const;
    }),
  );
  return { fees: Object.fromEntries(entries) as Record<OfferingTypeKey, ConsultationFeeQuote> };
}

/** Freeze fee and FX onto a new booking. */
export async function lockConsultationCharge(feeNGN: number, currency: ChargeCurrency) {
  if (currency === "NGN") return { amount: feeNGN, data: { fxAmountLocked: null } };
  const fx = await getLockedFx();
  const amount = consultationChargeAt(feeNGN, currency, fx);
  return { amount, data: { ...persistableFxFields(fx), fxAmountLocked: amount } };
}

type ChargeableBooking = {
  feeNGN: number;
  currency: string | null;
  fxAmountLocked?: number | null;
  fxRateLocked?: number | null;
  fxGbpRateLocked?: number | null;
  fxRateSource?: string | null;
  fxRateFetchedAt?: Date | null;
  fxRateStale?: boolean | null;
};

/**
 * What a booking charges, in major units, and in which currency. Initiate
 * routes charge this and the Slice A bind expects it.
 * - Locked (BA3 USD/GBP): exactly fxAmountLocked in the booking's currency.
 * - NGN: the frozen fee.
 * - Legacy USD/GBP made before BA3: the frozen fee at today's rate, as before.
 */
export async function consultationCharge(booking: ChargeableBooking): Promise<{ major: number; currency: ChargeCurrency }> {
  const currency = asChargeCurrency(booking.currency);
  if (currency === "NGN") return { major: booking.feeNGN, currency };
  if (booking.fxAmountLocked != null && booking.fxAmountLocked > 0) {
    return { major: booking.fxAmountLocked, currency };
  }
  if (booking.fxRateLocked) {
    return { major: consultationChargeAt(booking.feeNGN, currency, lockedFxFromOrder(booking)), currency };
  }
  const rates = await getExchangeRates();
  return { major: roundMoney(convertFromNGN(booking.feeNGN, currency as ShopCurrency, rates)), currency };
}

/**
 * Slice A bind for a consultation: what the gateway must have charged. Uses the
 * same rounded amount the initiate routes charged. For a locked booking a
 * different gateway currency is expected in the booking's own currency, so the
 * bind refuses it — stricter than the live conversion it replaces.
 */
export async function expectedConsultationBind(
  gateway: PaymentGateway,
  booking: ChargeableBooking,
  pspCurrency: string | null | undefined,
): Promise<{ amount: number; currency: string }> {
  const charge =
    (pspCurrency ? await consultationChargeIn(booking, pspCurrency) : null) ?? (await consultationCharge(booking));
  return { amount: expectedAmountInPspUnits(gateway, charge.major), currency: charge.currency };
}

/**
 * The charge in the currency a gateway was asked for. A locked booking charges
 * only in its own currency (null otherwise: the caller refuses); a legacy
 * booking converts its fee live, as before BA3.
 */
export async function consultationChargeIn(
  booking: ChargeableBooking,
  requested: string,
): Promise<{ major: number; currency: ChargeCurrency } | null> {
  const want = asChargeCurrency(requested);
  if (want === asChargeCurrency(booking.currency)) return consultationCharge(booking);
  if (booking.fxAmountLocked != null || booking.fxRateLocked != null) return null;
  if (want === "NGN") return { major: booking.feeNGN, currency: "NGN" };
  const rates = await getExchangeRates();
  return { major: roundMoney(convertFromNGN(booking.feeNGN, want as ShopCurrency, rates)), currency: want };
}
