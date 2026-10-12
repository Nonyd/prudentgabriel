import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, resolveSessionAccess } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/store/http";
import { bespokeFacts } from "@/lib/atelier/bespoke-access";
import { sheetLabourNGN } from "@/lib/atelier/commission-cost";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const gate = await requireAdminApi("production.cost");
  if (!gate.ok) return gate.response;
  const { role } = await resolveSessionAccess(gate.session);
  const actorId = gate.session.user?.id;
  if (!actorId) return jsonError("Missing actor", 401);
  const { id } = await params;

  let body: { action?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* approve is default */
  }
  if (body.action && body.action !== "approve") {
    return jsonError("Unknown action.");
  }

  const row = await prisma.costOfProduction.findUnique({ where: { id } });
  if (!row) return jsonError("Not found", 404);
  if (row.status === "APPROVED") return jsonError("Already approved.", 409);

  const updated = await prisma.costOfProduction.update({
    where: { id },
    data: { status: "APPROVED", approvedById: actorId, approvedAt: new Date() },
  });
  void role;
  return NextResponse.json({ item: { id: updated.id, status: updated.status, approvedAt: updated.approvedAt } });
}

export async function GET(_req: NextRequest, { params }: Params) {
  const gate = await requireAdminApi(["production.cost", "store"]);
  if (!gate.ok) return gate.response;
  const seesLabour = Boolean((await bespokeFacts(gate.session)).facts.cost);
  const { id } = await params;
  const c = await prisma.costOfProduction.findUnique({
    where: { id },
    include: {
      items: { include: { item: { select: { id: true, name: true, unit: true } } } },
      labour: true,
      draftedBy: { select: { name: true, email: true } },
      approvedBy: { select: { name: true, email: true } },
      bespokeOrder: { select: { id: true, orderRef: true, clientName: true } },
      order: { select: { id: true, orderNumber: true } },
    },
  });
  if (!c) return jsonError("Not found", 404);
  return NextResponse.json({
    item: {
      ...c,
      // BD4: labour is for `production.cost`, not the store.
      tailorCostNGN: seesLabour ? sheetLabourNGN(c) : null,
      labour: seesLabour ? c.labour.map((l) => ({ ...l, amountNGN: Number(l.amountNGN) })) : null,
      items: c.items.map((i) => ({
        ...i,
        quantity: Number(i.quantity),
        estimatedCostNGN: Number(i.estimatedCostNGN),
      })),
    },
  });
}
