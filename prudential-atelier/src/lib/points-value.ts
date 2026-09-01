/** Pure Prudent Points arithmetic. Rate is naira per one point. */

export const DEFAULT_POINT_RATE_NGN = 1;
export const DEFAULT_MIN_REDEMPTION = 5_000;
export const DEFAULT_EXPIRY_MONTHS = 24;
export const NGN_PER_EARN_UNIT = 10;

export const SETTING_KEYS = {
  rateNGN: "prudent_points_rate_ngn",
  minRedemption: "prudent_points_min_redemption",
  expiryMonths: "prudent_points_expiry_months",
  /** Read fallback if the programme keys are not bootstrapped yet. */
  rateNGNLegacy: "loyalty_point_rate_ngn",
  minRedemptionLegacy: "loyalty_min_redemption_points",
} as const;

export const LOYALTY_ACTIONS = {
  SIGNUP: "SIGNUP",
  PURCHASE_PER_10: "PURCHASE_PER_10",
  REFERRAL_FIRST_ORDER: "REFERRAL_FIRST_ORDER",
  REVIEW: "REVIEW",
  NEWSLETTER: "NEWSLETTER",
  BIRTHDAY: "BIRTHDAY",
  STYLE_PROFILE: "STYLE_PROFILE",
} as const;

export type LoyaltyAction = (typeof LOYALTY_ACTIONS)[keyof typeof LOYALTY_ACTIONS];

export const PROGRAMME_DEFAULTS: Record<string, number> = {
  [LOYALTY_ACTIONS.SIGNUP]: 0,
  [LOYALTY_ACTIONS.PURCHASE_PER_10]: 1,
  [LOYALTY_ACTIONS.REFERRAL_FIRST_ORDER]: 12_500,
  [LOYALTY_ACTIONS.REVIEW]: 500,
  [LOYALTY_ACTIONS.NEWSLETTER]: 500,
  [LOYALTY_ACTIONS.BIRTHDAY]: 2_500,
  [LOYALTY_ACTIONS.STYLE_PROFILE]: 1_000,
};

/** Four lines. Do not grow this. */
export const PRUDENT_POINTS_COPY =
  "Earn 1 point for every ₦10 you spend. Every point is worth ₦1 towards a future piece. Introduce a friend and receive 12,500 points once she makes her first purchase. Points are valid for two years.";

export function pointsToNaira(points: number, rateNGN: number): number {
  if (points <= 0 || rateNGN <= 0) return 0;
  return Math.round(points * rateNGN * 100) / 100;
}

export function nairaToPoints(naira: number, rateNGN: number): number {
  if (naira <= 0 || rateNGN <= 0) return 0;
  return Math.floor(naira / rateNGN);
}

/** Cash paid toward the garment. A fully-points piece earns nothing. */
export function cashSpendNGN(garmentNGN: number, pointsDiscountNGN: number): number {
  return Math.max(0, garmentNGN - Math.max(0, pointsDiscountNGN));
}

export function purchasePointsFromSpend(cashNGN: number, pointsPerTen: number): number {
  if (cashNGN <= 0 || pointsPerTen <= 0) return 0;
  return Math.floor(cashNGN / NGN_PER_EARN_UNIT) * pointsPerTen;
}

export function addCalendarMonths(from: Date, months: number): Date {
  const d = new Date(from.getTime());
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  if (d.getUTCDate() < day) d.setUTCDate(0);
  return d;
}

/** Garment subtotal after coupon. Shipping is never redeemable. */
export function garmentEligibleNGN(subtotalNGN: number, discountNGN: number): number {
  return Math.max(0, subtotalNGN - Math.max(0, discountNGN));
}

export function maxRedeemablePoints(params: {
  subtotalNGN: number;
  discountNGN: number;
  rateNGN: number;
  availablePoints: number;
}): number {
  const eligible = garmentEligibleNGN(params.subtotalNGN, params.discountNGN);
  return Math.max(0, Math.min(params.availablePoints, nairaToPoints(eligible, params.rateNGN)));
}

export function clampRedemption(params: {
  requested: number;
  availablePoints: number;
  subtotalNGN: number;
  discountNGN: number;
  rateNGN: number;
  minRedemption: number;
}): { points: number; valueNGN: number } {
  if (params.requested <= 0) return { points: 0, valueNGN: 0 };
  const maxPts = maxRedeemablePoints(params);
  const points = Math.min(params.requested, maxPts);
  if (points > 0 && points < params.minRedemption) {
    return { points: 0, valueNGN: 0 };
  }
  const eligible = garmentEligibleNGN(params.subtotalNGN, params.discountNGN);
  const valueNGN = Math.min(eligible, pointsToNaira(points, params.rateNGN));
  return { points, valueNGN };
}

/** Plus-addressing and Gmail dots collapse so a@x and a+1@x cannot self-refer. */
export function emailRoot(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at < 1) return trimmed;
  let local = trimmed.slice(0, at);
  let domain = trimmed.slice(at + 1);
  local = local.split("+")[0] ?? local;
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") local = local.replace(/\./g, "");
  return `${local}@${domain}`;
}

export function phonesMatch(a?: string | null, b?: string | null): boolean {
  const norm = (p: string) => {
    const digits = p.replace(/\D/g, "");
    if (digits.length === 13 && digits.startsWith("234")) return `0${digits.slice(3)}`;
    if (digits.length === 12 && digits.startsWith("234")) return `0${digits.slice(3)}`;
    if (digits.length === 11 && digits.startsWith("234")) return digits;
    return digits;
  };
  const na = a ? norm(a) : "";
  const nb = b ? norm(b) : "";
  if (na.length < 7 || nb.length < 7) return false;
  return na === nb || na.endsWith(nb) || nb.endsWith(na);
}
