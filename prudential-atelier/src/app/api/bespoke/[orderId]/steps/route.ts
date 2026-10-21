import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { bespokeView, requireBespokeAccess } from "@/lib/atelier/bespoke-access";
import { actorFromSession } from "@/lib/atelier/stage-actions";
import { bespokeAdminDetailInclude } from "@/lib/atelier/can-complete-stage";
import { editOrderSteps } from "@/lib/atelier/pipeline-actions";
import { CUSTOM_LABEL_MAX } from "@/lib/atelier/pipeline";
import { canSeeOrderMeasurements, redactBespokeOrder } from "@/lib/bespoke-data-access";

type Params = { params: Promise<{ orderId: string }> };

const id = z.string().min(1).max(64);
const requirements = {
  requiresNotes: z.boolean().optional(),
  minMediaCount: z.number().int().min(0).max(10).optional(),
  requiresClientApproval: z.boolean().optional(),
};

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("move"), stepId: id, direction: z.enum(["up", "down"]) }),
  z.object({ action: z.literal("skip"), stepId: id, reason: z.string().trim().min(3, "Say why this step is skipped").max(500) }),
  z.object({ action: z.literal("unskip"), stepId: id }),
  z.object({
    action: z.literal("add"),
    afterStepId: id,
    label: z.string().trim().min(1, "Give the step a name").max(CUSTOM_LABEL_MAX),
    clientDescription: z.string().trim().max(600).optional().nullable(),
    ...requirements,
  }),
  z.object({
    action: z.literal("edit"),
    stepId: id,
    label: z.string().trim().max(CUSTOM_LABEL_MAX).optional().nullable(),
    clientDescription: z.string().trim().max(600).optional().nullable(),
    ...requirements,
  }),
  z.object({ action: z.literal("remove"), stepId: id }),
  z.object({ action: z.literal("start"), stepId: id }),
]);

/**
 * Change one commission's steps. Admins and atelier managers (`bespoke.pipeline`);
 * staff complete the steps they are given but cannot rearrange them.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { orderId } = await params;
  const gate = await requireBespokeAccess("pipeline", { orderId });
  if (!gate.ok) return gate.response;
  const actor = actorFromSession(gate.session);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
  }

  const result = await editOrderSteps({
    orderId,
    edit: parsed.data,
    actor: { id: actor.id, email: actor.email, role: actor.role ? String(actor.role) : null },
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.failures[0]?.message ?? "Cannot change the steps", failures: result.failures },
      { status: result.status },
    );
  }

  const updated = await prisma.bespokeOrder.findUnique({
    where: { id: orderId },
    include: bespokeAdminDetailInclude(),
  });
  if (!updated) return NextResponse.json({ item: null });
  const view = bespokeView(gate.facts);
  const access = {
    payments: view.money,
    materialCost: view.materialCost,
    measurements: await canSeeOrderMeasurements(gate.session.user, orderId),
  };
  return NextResponse.json({ item: redactBespokeOrder(updated, access) });
}
