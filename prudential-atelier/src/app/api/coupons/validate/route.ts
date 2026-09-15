import { NextRequest, NextResponse } from "next/server";
import { validateCoupon } from "@/lib/coupon";
import { expireStaleCheckoutReservationsForActor } from "@/lib/checkout-reservations";
import { couponValidateSchema } from "@/validations/coupon";

export async function POST(req: NextRequest) {
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
  return NextResponse.json(result);
}
