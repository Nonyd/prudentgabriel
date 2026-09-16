import { NextRequest, NextResponse } from "next/server";
import { StoreMovementReason } from "@prisma/client";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { fromStoreError, jsonError, MOVEMENT_INCLUDE, movementJson } from "@/lib/store/http";
import { appendMovement, parseQty } from "@/lib/store/ledger";

const WRITE_REASONS = new Set<StoreMovementReason>(["RECEIPT", "ADJUSTMENT", "WRITE_OFF"]);

export async function GET(req: NextRequest) {
  const gate = await requireAdminApi("store");
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(req.url);
  const itemId = searchParams.get("itemId") || undefined;
  const reason = searchParams.get("reason");
  const ref = searchParams.get("ref") || undefined;
  const take = Math.min(200, Math.max(1, Number(searchParams.get("take") ?? "80") || 80));

  const where = {
    ...(itemId ? { itemId } : {}),
    ...(ref ? { ref } : {}),
    ...(reason && Object.values(StoreMovementReason).includes(reason as StoreMovementReason)
      ? { reason: reason as StoreMovementReason }
      : {}),
  };

  const items = await prisma.storeMovement.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    include: MOVEMENT_INCLUDE,
  });
  return NextResponse.json({ items: items.map(movementJson) });
}

export async function POST(req: NextRequest) {
  const gate = await requireAdminApi("store");
  if (!gate.ok) return gate.response;
  const actorId = gate.session.user?.id;
  if (!actorId) return jsonError("Missing actor", 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON");
  }

  const reason = body.reason as StoreMovementReason;
  if (!WRITE_REASONS.has(reason)) {
    return jsonError("Use the issue book, return, or opening count for that kind of movement.");
  }
  const itemId = typeof body.itemId === "string" ? body.itemId : "";
  const qty = parseQty(body.quantity as string | number);
  if (!itemId || qty == null) return jsonError("Item and quantity are required.");

  const signed =
    reason === "WRITE_OFF" ? -Math.abs(qty) : reason === "ADJUSTMENT" ? qty : Math.abs(qty);

  try {
    const row = await appendMovement({
      itemId,
      delta: signed,
      reason,
      actorId,
      note: typeof body.note === "string" ? body.note : null,
      ref: typeof body.ref === "string" ? body.ref : null,
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
