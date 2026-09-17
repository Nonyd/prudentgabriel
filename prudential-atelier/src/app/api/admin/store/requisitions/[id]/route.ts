import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, resolveSessionAccess } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/store/http";
import {
  RequisitionError,
  advanceRequisition,
  declineRequisition,
  suggestStockCoverage,
} from "@/lib/requisition/chain";
import { nextRequisitionStatus, STATUS_LABEL } from "@/lib/requisition/states";

type Params = { params: Promise<{ id: string }> };

const DETAIL_INCLUDE = {
  lines: { include: { item: { select: { id: true, name: true, unit: true } } } },
  raisedBy: { select: { id: true, name: true, email: true } },
  bespokeOrder: { select: { id: true, orderRef: true, clientName: true } },
  order: { select: { id: true, orderNumber: true } },
  costOfProduction: {
    select: {
      id: true,
      tailorCostNGN: true,
      approvedBy: { select: { name: true, email: true } },
    },
  },
  events: {
    orderBy: { createdAt: "asc" as const },
    include: { actor: { select: { name: true, email: true } } },
  },
} as const;

function serialize(r: Awaited<ReturnType<typeof load>>) {
  if (!r) return null;
  const buyLines = r.lines.filter((l) => !l.coveredByStock);
  const stockCheckEvent = [...r.events].reverse().find((e) => e.toStatus === "STOCK_CHECKED");
  return {
    id: r.id,
    ref: r.ref,
    status: r.status,
    statusLabel: STATUS_LABEL[r.status],
    nextStatus: nextRequisitionStatus(r.status),
    notes: r.notes,
    declineReason: r.declineReason,
    sameActorShortCircuit: r.sameActorShortCircuit,
    raisedByName: r.raisedBy.name || r.raisedBy.email,
    client: r.bespokeOrder?.clientName ?? (r.order?.orderNumber ? `Order ${r.order.orderNumber}` : null),
    orderRef: r.bespokeOrder?.orderRef ?? r.order?.orderNumber ?? null,
    orderId: r.orderId,
    bespokeOrderId: r.bespokeOrderId,
    tailorCostNGN: r.costOfProduction ? Number(r.costOfProduction.tailorCostNGN) : null,
    stockCheckedByName: stockCheckEvent
      ? stockCheckEvent.actor.name || stockCheckEvent.actor.email
      : null,
    totalNGN: buyLines.reduce((s, l) => s + Number(l.estimatedCostNGN), 0),
    lines: r.lines.map((l) => ({
      id: l.id,
      itemId: l.itemId,
      name: l.item?.name ?? l.freeText,
      quantity: Number(l.quantity),
      unit: l.unit,
      estimatedCostNGN: Number(l.estimatedCostNGN),
      confirmedQuantity: l.confirmedQuantity != null ? Number(l.confirmedQuantity) : null,
      coveredByStock: l.coveredByStock,
      shortfallQuantity: l.shortfallQuantity != null ? Number(l.shortfallQuantity) : null,
    })),
    events: r.events.map((e) => ({
      id: e.id,
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      actorName: e.actor.name || e.actor.email,
      note: e.note,
      sameActorAsPrevious: e.sameActorAsPrevious,
      createdAt: e.createdAt,
    })),
    createdAt: r.createdAt,
  };
}

async function load(id: string) {
  return prisma.requisition.findUnique({ where: { id }, include: DETAIL_INCLUDE });
}

export async function GET(_req: NextRequest, { params }: Params) {
  const gate = await requireAdminApi([
    "store",
    "production.cost",
    "requisition.approve",
    "requisition.fund",
    "requisition.buy",
    "payments",
  ]);
  if (!gate.ok) return gate.response;
  const { id } = await params;
  const r = await load(id);
  if (!r) return jsonError("Not found", 404);
  const coverage = r.status === "RAISED" ? await suggestStockCoverage(id) : [];
  return NextResponse.json({ item: serialize(r), coverage });
}

export async function POST(req: NextRequest, { params }: Params) {
  const gate = await requireAdminApi([
    "store",
    "production.cost",
    "requisition.approve",
    "requisition.fund",
    "requisition.buy",
    "payments",
  ]);
  if (!gate.ok) return gate.response;
  const { role } = await resolveSessionAccess(gate.session);
  const actorId = gate.session.user?.id;
  if (!actorId) return jsonError("Missing actor", 401);
  const { id } = await params;

  let body: {
    action?: "advance" | "decline";
    note?: string;
    reason?: string;
    lines?: {
      id: string;
      coveredByStock?: boolean;
      confirmedQuantity?: number | null;
      shortfallQuantity?: number | null;
    }[];
  };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON");
  }

  const actor = {
    id: actorId,
    role,
    name: gate.session.user?.name,
    email: gate.session.user?.email,
  };

  try {
    if (body.action === "decline") {
      await declineRequisition({ requisitionId: id, actor, reason: body.reason || "" });
    } else {
      await advanceRequisition({
        requisitionId: id,
        actor,
        note: body.note,
        lines: body.lines,
      });
    }
    const r = await load(id);
    return NextResponse.json({ item: serialize(r) });
  } catch (e) {
    if (e instanceof RequisitionError) {
      return jsonError(e.message, e.status);
    }
    return jsonError(e instanceof Error ? e.message : "Failed", 400);
  }
}
