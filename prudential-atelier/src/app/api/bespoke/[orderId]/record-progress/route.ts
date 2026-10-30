import { NextRequest, NextResponse } from "next/server";
import { BespokeStage } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBespokeAccess } from "@/lib/atelier/bespoke-access";
import { actorFromSession } from "@/lib/atelier/stage-actions";
import { bespokeAdminDetailInclude } from "@/lib/atelier/can-complete-stage";
import { recordProgressOutsideApp } from "@/lib/atelier/record-progress";

type Params = { params: Promise<{ orderId: string }> };

const bodySchema = z.object({
  targetStage: z.nativeEnum(BespokeStage),
  reason: z.string().trim().min(3, "Say why this is recorded by hand").max(500),
  stages: z
    .partialRecord(
      z.nativeEnum(BespokeStage),
      z.object({
        note: z.string().trim().max(1000).optional().nullable(),
        doneOn: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(""), z.null()]).optional(),
      }),
    )
    .optional(),
});

/** Move a commission forward to where it really is, for work done outside the app. Admins only. */
export async function POST(req: NextRequest, { params }: Params) {
  const { orderId } = await params;
  const gate = await requireBespokeAccess("admin", { orderId });
  if (!gate.ok) return gate.response;
  const actor = actorFromSession(gate.session);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
  }

  const result = await recordProgressOutsideApp({ orderId, actor, ...parsed.data });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  const item = await prisma.bespokeOrder.findUnique({ where: { id: orderId }, include: bespokeAdminDetailInclude() });
  return NextResponse.json({ ok: true, recorded: result.recorded, item });
}
