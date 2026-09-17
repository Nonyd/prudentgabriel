import { NextRequest, NextResponse } from "next/server";
import { Prisma, RequisitionStatus } from "@prisma/client";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/store/http";
import { newRequisitionRef } from "@/lib/requisition/states";
import { parseQty } from "@/lib/store/qty";
import { createNotification } from "@/lib/notifications";

export async function GET(req: NextRequest) {
  const gate = await requireAdminApi([
    "store",
    "production.cost",
    "requisition.approve",
    "requisition.fund",
    "requisition.buy",
    "payments",
  ]);
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as RequisitionStatus | null;
  const fundQueue = searchParams.get("fund") === "1";

  const items = await prisma.requisition.findMany({
    where: fundQueue
      ? { status: "AWAITING_FUNDS" }
      : status && Object.values(RequisitionStatus).includes(status)
        ? { status }
        : undefined,
    orderBy: { createdAt: "desc" },
    take: 80,
    include: {
      lines: { include: { item: { select: { name: true, unit: true } } } },
      raisedBy: { select: { name: true, email: true } },
      bespokeOrder: { select: { orderRef: true, clientName: true } },
      order: { select: { orderNumber: true } },
      events: {
        orderBy: { createdAt: "asc" },
        include: { actor: { select: { name: true, email: true } } },
      },
    },
  });

  return NextResponse.json({
    items: items.map((r) => ({
      id: r.id,
      ref: r.ref,
      status: r.status,
      notes: r.notes,
      declineReason: r.declineReason,
      sameActorShortCircuit: r.sameActorShortCircuit,
      raisedByName: r.raisedBy.name || r.raisedBy.email,
      client: r.bespokeOrder?.clientName ?? (r.order?.orderNumber ? `Order ${r.order.orderNumber}` : null),
      orderRef: r.bespokeOrder?.orderRef ?? r.order?.orderNumber ?? null,
      orderId: r.orderId,
      bespokeOrderId: r.bespokeOrderId,
      totalNGN: r.lines
        .filter((l) => !l.coveredByStock)
        .reduce((s, l) => s + Number(l.estimatedCostNGN), 0),
      lineCount: r.lines.length,
      createdAt: r.createdAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const gate = await requireAdminApi("store");
  if (!gate.ok) return gate.response;
  const actorId = gate.session.user?.id;
  if (!actorId) return jsonError("Missing actor", 401);

  let body: {
    costOfProductionId?: string | null;
    orderId?: string | null;
    bespokeOrderId?: string | null;
    notes?: string;
    lines?: {
      itemId?: string | null;
      freeText?: string | null;
      quantity?: string | number;
      unit?: string;
      estimatedCostNGN?: number | string;
    }[];
  };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON");
  }

  let orderId = body.orderId || null;
  let bespokeOrderId = body.bespokeOrderId || null;
  let lines = Array.isArray(body.lines) ? body.lines : [];

  if (body.costOfProductionId) {
    const cop = await prisma.costOfProduction.findUnique({
      where: { id: body.costOfProductionId },
      include: { items: true },
    });
    if (!cop) return jsonError("Cost of production not found.", 404);
    if (cop.status !== "APPROVED") return jsonError("Approve the cost of production first.");
    orderId = orderId || cop.orderId;
    bespokeOrderId = bespokeOrderId || cop.bespokeOrderId;
    if (lines.length === 0) {
      lines = cop.items.map((i) => ({
        itemId: i.itemId,
        freeText: i.freeText,
        quantity: Number(i.quantity),
        unit: i.unit,
        estimatedCostNGN: Number(i.estimatedCostNGN),
      }));
    }
  }

  if (!orderId && !bespokeOrderId) return jsonError("Link a shop order or a commission.");
  if (lines.length === 0) return jsonError("Add at least one line.");

  const ref = newRequisitionRef();
  try {
    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.requisition.create({
        data: {
          ref,
          costOfProductionId: body.costOfProductionId || null,
          orderId,
          bespokeOrderId,
          raisedById: actorId,
          notes: body.notes?.trim() || null,
          lines: {
            create: lines.map((line) => {
              const qty = parseQty(line.quantity ?? null);
              const cost =
                typeof line.estimatedCostNGN === "number"
                  ? line.estimatedCostNGN
                  : Number(line.estimatedCostNGN);
              if (qty == null || qty <= 0) throw new Error("Each line needs a positive quantity.");
              if (!Number.isFinite(cost) || cost < 0) throw new Error("Each line needs an estimated cost.");
              if (!line.itemId && !line.freeText?.trim()) {
                throw new Error("Each line needs a store item or free text.");
              }
              return {
                itemId: line.itemId || null,
                freeText: line.freeText?.trim() || null,
                quantity: new Prisma.Decimal(qty),
                unit: (line.unit || "yard").trim(),
                estimatedCostNGN: new Prisma.Decimal(cost),
              };
            }),
          },
        },
      });
      await tx.requisitionEvent.create({
        data: {
          requisitionId: row.id,
          fromStatus: null,
          toStatus: "RAISED",
          actorId,
          note: "Raised",
        },
      });
      return row;
    });

    void createNotification({
      type: "REQUISITION_PENDING",
      title: `Requisition ${ref} raised`,
      message: "Waiting for stock check.",
      link: `/admin/store/requisitions/${created.id}`,
      entityId: created.id,
      targetPermissions: ["requisition.approve"],
    }).catch(() => {});

    return NextResponse.json({ item: { id: created.id, ref } }, { status: 201 });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Could not raise", 400);
  }
}
