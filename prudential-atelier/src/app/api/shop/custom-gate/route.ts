import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertCustomLineAllowed } from "@/lib/custom-availability";

const bodySchema = z.object({
  productId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const result = await assertCustomLineAllowed(parsed.data.productId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error, allowed: false }, { status: result.status });
  }
  return NextResponse.json({ allowed: true });
}
