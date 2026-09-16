import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { fromStoreError, jsonError, MOVEMENT_INCLUDE, movementJson } from "@/lib/store/http";
import { appendMovement, newIssueRef, parseQty } from "@/lib/store/ledger";

export async function GET(req: NextRequest) {
  const gate = await requireAdminApi("store");
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(req.url);
  const outstanding = searchParams.get("outstanding") === "1";
  const take = Math.min(200, Math.max(1, Number(searchParams.get("take") ?? "80") || 80));

  const rows = await prisma.storeMovement.findMany({
    where: { reason: "ISSUE" },
    orderBy: { createdAt: "desc" },
    take: outstanding ? 200 : take,
    include: MOVEMENT_INCLUDE,
  });
  const items = rows.map(movementJson);
  return NextResponse.json({
    items: outstanding ? items.filter((i) => (i.outstanding ?? 0) > 1e-9) : items,
  });
}

export async function POST(req: NextRequest) {
  const gate = await requireAdminApi("store");
  if (!gate.ok) return gate.response;
  const actorId = gate.session.user?.id;
  if (!actorId) return jsonError("Missing actor", 401);

  let body: {
    takenById?: string;
    approvedById?: string;
    bespokeOrderId?: string | null;
    orderId?: string | null;
    note?: string;
    lines?: { itemId?: string; quantity?: string | number; note?: string }[];
  };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON");
  }

  if (!body.takenById || !body.approvedById) {
    return jsonError("An issue needs who is taking it and the supervisor who approved.");
  }
  const lines = Array.isArray(body.lines) ? body.lines : [];
  if (lines.length === 0) return jsonError("Add at least one material line.");

  const ref = newIssueRef();
  try {
    const created = await prisma.$transaction(async (tx) => {
      const out = [];
      for (const line of lines) {
        const itemId = typeof line.itemId === "string" ? line.itemId : "";
        const qty = parseQty(line.quantity ?? null);
        if (!itemId || qty == null || qty <= 0) {
          throw new Error("Each line needs an item and a positive quantity.");
        }
        const row = await appendMovement(
          {
            itemId,
            delta: -qty,
            reason: "ISSUE",
            actorId,
            takenById: body.takenById,
            approvedById: body.approvedById,
            bespokeOrderId: body.bespokeOrderId || null,
            orderId: body.orderId || null,
            note: line.note || body.note || null,
            ref,
          },
          tx,
        );
        out.push(row.id);
      }
      return out;
    });

    const items = await prisma.storeMovement.findMany({
      where: { id: { in: created } },
      include: MOVEMENT_INCLUDE,
    });
    return NextResponse.json({ ref, items: items.map(movementJson) }, { status: 201 });
  } catch (e) {
    return fromStoreError(e);
  }
}
