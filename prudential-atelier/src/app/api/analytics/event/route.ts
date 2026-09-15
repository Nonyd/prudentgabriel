import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { recordAnalyticsEvent } from "@/lib/analytics/record";
import { sanitizeAttribution, visitAttributionSchema } from "@/lib/analytics/attribution";
import { ADMIN_IMPERSONATE_COOKIE } from "@/lib/admin-impersonate";

const bodySchema = z.object({
  path: z.string().max(200).optional(),
  productId: z.string().max(40).optional(),
  event: z.string().max(40).optional(),
  landing: z.boolean().optional(),
  referral: visitAttributionSchema,
});

export async function POST(req: NextRequest) {
  const impersonating = Boolean(req.cookies.get(ADMIN_IMPERSONATE_COOKIE)?.value);
  let json: unknown;
  try {
    const text = await req.text();
    json = text ? JSON.parse(text) : {};
  } catch {
    return new NextResponse(null, { status: 204 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return new NextResponse(null, { status: 204 });
  }

  const ua = req.headers.get("user-agent");
  await recordAnalyticsEvent({
    path: parsed.data.path,
    productId: parsed.data.productId,
    event: parsed.data.event,
    landing: parsed.data.landing,
    referral: sanitizeAttribution(parsed.data.referral),
    userAgent: ua,
    impersonating,
  });

  return new NextResponse(null, { status: 204 });
}
