import { NextRequest, NextResponse } from "next/server";
import { validateCoupon } from "@/lib/coupon";
import { expireStaleCheckoutReservationsForActor } from "@/lib/checkout-reservations";
import { couponValidateSchema } from "@/validations/coupon";
import { rateLimitOr429 } from "@/lib/rate-limit";

/** One message for unknown, inactive, not-yet-active, expired and used-up codes, so they can't be told apart. */
const GENERIC_COUPON_ERROR = "This code isn't valid";

/** Messages that only make sense once the shopper holds a live code; these stay specific. */
function isShopperFixableError(error: string): boolean {
  return (
    error.startsWith("Minimum order") ||
    error === "This coupon does not apply to items in your bag" ||
    error === "You have already used this coupon"
  );
}

export async function POST(req: NextRequest) {
  const limited = await rateLimitOr429(req, "coupon-validate", 20, 10 * 60 * 1000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = couponValidateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { code, subtotalNGN, email, cartLines } = parsed.data;
  await expireStaleCheckoutReservationsForActor({ email });
  const lines = cartLines.map((l) => ({
    priceNGN: l.priceNGN,
    quantity: l.quantity,
    category: l.category,
  }));

  const result = await validateCoupon(code, subtotalNGN, email, null, lines);
  if (!result.valid && !(result.error && isShopperFixableError(result.error))) {
    return NextResponse.json({ ...result, error: GENERIC_COUPON_ERROR });
  }
  return NextResponse.json(result);
}
