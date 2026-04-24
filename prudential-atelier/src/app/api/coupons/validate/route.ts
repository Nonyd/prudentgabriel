import { NextRequest, NextResponse } from "next/server";
import { ProductCategory } from "@prisma/client";
import { validateCoupon } from "@/lib/coupon";
import { couponValidateSchema } from "@/validations/coupon";

function parseCategory(raw: string | undefined): ProductCategory | undefined {
  if (!raw) return undefined;
  const vals = Object.values(ProductCategory) as string[];
  return vals.includes(raw) ? (raw as ProductCategory) : undefined;
}

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
  const lines = cartLines.map((l) => ({
    priceNGN: l.priceNGN,
    quantity: l.quantity,
    category: parseCategory(l.category),
  }));

  const result = await validateCoupon(code, subtotalNGN, email, null, lines);
  return NextResponse.json(result);
}
