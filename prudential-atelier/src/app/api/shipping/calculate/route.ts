import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { calculateShippingOptions } from "@/lib/shipping";

const bodySchema = z.object({
  address: z.object({
    city: z.string().min(1),
    state: z.string().min(1),
    country: z.string().length(2),
  }),
  subtotalNGN: z.number().nonnegative(),
  totalWeightKg: z.number().nonnegative().optional().default(0.5),
  isFreeShippingCoupon: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { address, subtotalNGN, totalWeightKg, isFreeShippingCoupon } = parsed.data;
  const options = await calculateShippingOptions(
    address,
    subtotalNGN,
    totalWeightKg,
    isFreeShippingCoupon,
  );
  return NextResponse.json({ options });
}
