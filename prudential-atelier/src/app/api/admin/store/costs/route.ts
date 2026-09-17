import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/store/http";
import { parseQty } from "@/lib/store/qty";

export async function GET(req: NextRequest) {
  const gate = await requireAdminApi(["production.cost", "store"]);
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const items = await prisma.costOfProduction.findMany({
    where: status === "DRAFT" || status === "APPROVED" ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: 80,
    include: {
      items: { include: { item: { select: { name: true, unit: true } } } },
      draftedBy: { select: { name: true, email: true } },
      approvedBy: { select: { name: true, email: true } },
      bespokeOrder: { select: { orderRef: true, clientName: true } },
      order: { select: { orderNumber: true } },
    },
  });
  return NextResponse.json({
    items: items.map((c) => ({
      id: c.id,
      status: c.status,
      tailorCostNGN: Number(c.tailorCostNGN),
      notes: c.notes,
      approvedAt: c.approvedAt,
      draftedByName: c.draftedBy.name || c.draftedBy.email,
      approvedByName: c.approvedBy ? c.approvedBy.name || c.approvedBy.email : null,
      client: c.bespokeOrder?.clientName ?? (c.order?.orderNumber ? `Order ${c.order.orderNumber}` : null),
      orderRef: c.bespokeOrder?.orderRef ?? c.order?.orderNumber ?? null,
      bespokeOrderId: c.bespokeOrderId,
      orderId: c.orderId,
      materialsCostNGN: c.items.reduce((s, i) => s + Number(i.estimatedCostNGN), 0),
      lines: c.items.map((i) => ({
        id: i.id,
        itemId: i.itemId,
        name: i.item?.name ?? i.freeText,
        quantity: Number(i.quantity),
        unit: i.unit,
        estimatedCostNGN: Number(i.estimatedCostNGN),
      })),
    })),
  });
}

export async function POST(req: NextRequest) {
  const gate = await requireAdminApi("production.cost");
  if (!gate.ok) return gate.response;
  const actorId = gate.session.user?.id;
  if (!actorId) return jsonError("Missing actor", 401);

  let body: {
    orderId?: string | null;
    bespokeOrderId?: string | null;
    tailorCostNGN?: number | string;
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

  if (!body.orderId && !body.bespokeOrderId) {
    return jsonError("Link a shop order or a commission.");
  }
  const tailor = typeof body.tailorCostNGN === "number" ? body.tailorCostNGN : Number(body.tailorCostNGN);
  if (!Number.isFinite(tailor) || tailor < 0) return jsonError("Tailor cost is required.");

  const lines = Array.isArray(body.lines) ? body.lines : [];
  if (lines.length === 0) return jsonError("Add at least one material line.");

  try {
    const created = await prisma.costOfProduction.create({
      data: {
        orderId: body.orderId || null,
        bespokeOrderId: body.bespokeOrderId || null,
        tailorCostNGN: new Prisma.Decimal(tailor),
        notes: body.notes?.trim() || null,
        draftedById: actorId,
        items: {
          create: lines.map((line) => {
            const qty = parseQty(line.quantity ?? null);
            const cost = typeof line.estimatedCostNGN === "number" ? line.estimatedCostNGN : Number(line.estimatedCostNGN);
            if (qty == null || qty <= 0) throw new Error("Each line needs a positive quantity.");
            if (!Number.isFinite(cost) || cost < 0) throw new Error("Each line needs an estimated cost.");
            if (!line.itemId && !line.freeText?.trim()) throw new Error("Each line needs a store item or free text.");
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
    return NextResponse.json({ item: { id: created.id } }, { status: 201 });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Could not save", 400);
  }
}
