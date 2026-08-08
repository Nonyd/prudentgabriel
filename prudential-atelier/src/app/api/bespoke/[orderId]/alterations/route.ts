import { NextRequest, NextResponse } from "next/server";
import { AlterationReason } from "@prisma/client";
import { auth } from "@/auth";
import { createAlterationRequest } from "@/lib/alterations/service";
import { z } from "zod";

type Params = { params: Promise<{ orderId: string }> };

const bodySchema = z.object({
  description: z.string().min(10).max(4000),
  reason: z.nativeEnum(AlterationReason),
  media: z.array(z.string().url()).max(8).optional(),
});

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role && session.user.role !== "CUSTOMER") {
    return NextResponse.json({ error: "Only clients can raise alterations" }, { status: 403 });
  }

  const { orderId } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const item = await createAlterationRequest({
      orderId,
      clientUserId: session.user.id,
      description: parsed.data.description,
      reason: parsed.data.reason,
      media: parsed.data.media,
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    const map: Record<string, number> = {
      NOT_FOUND: 404,
      ARCHIVED: 400,
      NOT_DELIVERED: 400,
      NO_PROFILE: 400,
      FORBIDDEN: 403,
    };
    return NextResponse.json({ error: msg }, { status: map[msg] ?? 500 });
  }
}
