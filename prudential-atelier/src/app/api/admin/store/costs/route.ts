import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/store/http";
import { parseQty } from "@/lib/store/qty";
import { bespokeFacts } from "@/lib/atelier/bespoke-access";
import { sheetLabourNGN } from "@/lib/atelier/commission-cost";

export async function GET(req: NextRequest) {
  const gate = await requireAdminApi(["production.cost", "store"]);
  if (!gate.ok) return gate.response;
  // BD4: the store sees the store's side; labour is for `production.cost`.
  const seesLabour = Boolean((await bespokeFacts(gate.session)).facts.cost);

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const items = await prisma.costOfProduction.findMany({
    where: status === "DRAFT" || status === "APPROVED" ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: 80,
    include: {
      items: { include: { item: { select: { name: true, unit: true } } } },
      labour: { select: { amountNGN: true, role: true, description: true, assignmentId: true } },
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
      tailorCostNGN: seesLabour ? sheetLabourNGN(c) : null,
      labour: seesLabour
        ? c.labour.map((l) => ({ role: l.role, description: l.description, amountNGN: Number(l.amountNGN), assignmentId: l.assignmentId }))
        : null,
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
    /** BD4: one line per person, each pointing at the assignment it pays. */
    labour?: { assignmentId?: string | null; role?: string; description?: string | null; amountNGN?: number | string }[];
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
  const labourIn = Array.isArray(body.labour) ? body.labour : [];
  const labour: { assignmentId: string | null; role: string; description: string | null; amountNGN: number }[] = [];
  for (const l of labourIn) {
    const amount = typeof l.amountNGN === "number" ? l.amountNGN : Number(l.amountNGN);
    if (!Number.isFinite(amount) || amount < 0) return jsonError("Each labour line needs an amount.");
    labour.push({
      assignmentId: l.assignmentId || null,
      role: (l.role || "TAILOR").trim().toUpperCase().slice(0, 40),
      description: l.description?.trim() || null,
      amountNGN: amount,
    });
  }
  if (labour.some((l) => l.assignmentId)) {
    if (!body.bespokeOrderId) return jsonError("Labour lines point at a commission's assignments.");
    const ids = labour.map((l) => l.assignmentId).filter((v): v is string => Boolean(v));
    const found = await prisma.orderAssignment.findMany({
      where: { id: { in: ids }, orderId: body.bespokeOrderId },
      select: { id: true, role: true },
    });
    if (found.length !== new Set(ids).size) return jsonError("A labour line points at someone not on this commission.");
    const roleOf = new Map(found.map((a) => [a.id, a.role]));
    for (const l of labour) if (l.assignmentId) l.role = roleOf.get(l.assignmentId) ?? l.role;
  }
  // With labour lines the tailor figure is their sum, written together — one source.
  const tailor = labour.length
    ? labour.reduce((s, l) => s + l.amountNGN, 0)
    : typeof body.tailorCostNGN === "number"
      ? body.tailorCostNGN
      : Number(body.tailorCostNGN);
  if (!Number.isFinite(tailor) || tailor < 0) return jsonError("Tailor cost is required.");

  const lines = Array.isArray(body.lines) ? body.lines : [];
  if (lines.length === 0 && labour.length === 0) return jsonError("Add at least one material or labour line.");

  try {
    const created = await prisma.costOfProduction.create({
      data: {
        orderId: body.orderId || null,
        bespokeOrderId: body.bespokeOrderId || null,
        tailorCostNGN: new Prisma.Decimal(tailor),
        notes: body.notes?.trim() || null,
        draftedById: actorId,
        labour: {
          create: labour.map((l) => ({ ...l, amountNGN: new Prisma.Decimal(l.amountNGN) })),
        },
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
