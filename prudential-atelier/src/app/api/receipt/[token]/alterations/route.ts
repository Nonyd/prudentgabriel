import { NextRequest, NextResponse } from "next/server";
import { rateLimitOr429 } from "@/lib/rate-limit";
import { AlterationReason } from "@prisma/client";
import { createAlterationRequestByReceiptToken } from "@/lib/alterations/service";
import { CAPABILITY_EXPIRED_COPY } from "@/lib/capability-token";
import { z } from "zod";

type Params = { params: Promise<{ token: string }> };

const bodySchema = z.object({
  description: z.string().min(10).max(4000),
  reason: z.nativeEnum(AlterationReason),
});

export async function POST(req: NextRequest, { params }: Params) {
  const limited = rateLimitOr429(req, "receipt-token-alteration", 5, 15 * 60 * 1000);
  if (limited) return limited;

  const { token } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  try {
    const item = await createAlterationRequestByReceiptToken({
      token,
      description: parsed.data.description,
      reason: parsed.data.reason,
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    const map: Record<string, number> = {
      NOT_FOUND: 404,
      TOKEN_EXPIRED: 410,
      ARCHIVED: 400,
      NOT_DELIVERED: 400,
      RECEIPT_REQUIRED: 400,
      WINDOW_CLOSED: 400,
      NO_PROFILE: 400,
      FORBIDDEN: 403,
    };
    const status = map[msg] ?? 500;
    const error =
      msg === "TOKEN_EXPIRED" ? CAPABILITY_EXPIRED_COPY.body : msg;
    return NextResponse.json({ error }, { status });
  }
}
