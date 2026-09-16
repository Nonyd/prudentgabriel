import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { fromStoreError, jsonError, MOVEMENT_INCLUDE, movementJson } from "@/lib/store/http";
import { appendMovement, parseQty } from "@/lib/store/ledger";

export async function POST(req: NextRequest) {
  const gate = await requireAdminApi("store");
  if (!gate.ok) return gate.response;
  const actorId = gate.session.user?.id;
  if (!actorId) return jsonError("Missing actor", 401);

  let body: { issueId?: string; quantity?: string | number; receivedById?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON");
  }

  if (!body.issueId || !body.receivedById) {
    return jsonError("A return closes against an issue and records the receiver.");
  }
  const qty = parseQty(body.quantity ?? null);
  if (qty == null || qty <= 0) return jsonError("Quantity is required.");

  const issue = await prisma.storeMovement.findUnique({
    where: { id: body.issueId },
    select: { itemId: true, reason: true, bespokeOrderId: true, orderId: true, ref: true },
  });
  if (!issue || issue.reason !== "ISSUE") return jsonError("Return must close against an issue.");

  try {
    const row = await appendMovement({
      itemId: issue.itemId,
      delta: qty,
      reason: "RETURN",
      actorId,
      issueId: body.issueId,
      receivedById: body.receivedById,
      note: body.note ?? null,
      ref: issue.ref,
      bespokeOrderId: issue.bespokeOrderId,
      orderId: issue.orderId,
    });
    const full = await prisma.storeMovement.findUniqueOrThrow({
      where: { id: row.id },
      include: MOVEMENT_INCLUDE,
    });
    return NextResponse.json({ item: movementJson(full) }, { status: 201 });
  } catch (e) {
    return fromStoreError(e);
  }
}
