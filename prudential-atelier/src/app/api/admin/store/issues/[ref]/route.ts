import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { MOVEMENT_INCLUDE, movementJson } from "@/lib/store/http";

type Params = { params: Promise<{ ref: string }> };

export async function GET(_req: Request, { params }: Params) {
  const gate = await requireAdminApi("store");
  if (!gate.ok) return gate.response;
  const { ref } = await params;

  const rows = await prisma.storeMovement.findMany({
    where: { ref, reason: "ISSUE" },
    orderBy: { createdAt: "asc" },
    include: MOVEMENT_INCLUDE,
  });
  if (rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const first = rows[0];
  return NextResponse.json({
    ref,
    createdAt: first.createdAt,
    takenByName: first.takenBy?.name || first.takenBy?.email || null,
    approvedByName: first.approvedBy?.name || first.approvedBy?.email || null,
    actorName: first.actor.name || first.actor.email,
    client: first.bespokeOrder?.clientName ?? (first.order?.orderNumber ? `Order ${first.order.orderNumber}` : null),
    orderRef: first.bespokeOrder?.orderRef ?? first.order?.orderNumber ?? null,
    items: rows.map(movementJson),
  });
}
