import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { fromStoreError, jsonError } from "@/lib/store/http";
import { appendMovement, getStoreBook, lockDayOne, parseQty } from "@/lib/store/ledger";

export async function GET() {
  const gate = await requireAdminApi("store");
  if (!gate.ok) return gate.response;
  const book = await getStoreBook();
  return NextResponse.json({
    book: { dayOne: book.dayOne, lockedAt: book.lockedAt, lockedById: book.lockedById },
  });
}

export async function POST(req: NextRequest) {
  const gate = await requireAdminApi("store");
  if (!gate.ok) return gate.response;
  const actorId = gate.session.user?.id;
  if (!actorId) return jsonError("Missing actor", 401);

  let body: {
    countedById?: string;
    dayOne?: string;
    lines?: { itemId?: string; quantity?: string | number }[];
  };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON");
  }

  const countedById = body.countedById || actorId;
  const lines = Array.isArray(body.lines) ? body.lines : [];
  if (lines.length === 0) return jsonError("Count at least one item.");

  const dayOne = body.dayOne ? new Date(body.dayOne) : new Date();
  if (Number.isNaN(dayOne.getTime())) return jsonError("Invalid date.");

  const counted = await prisma.user.findUnique({
    where: { id: countedById },
    select: { name: true, email: true },
  });
  const countedName = counted?.name || counted?.email || countedById;

  try {
    const created = await prisma.$transaction(async (tx) => {
      const ids: string[] = [];
      for (const line of lines) {
        const itemId = typeof line.itemId === "string" ? line.itemId : "";
        const qty = parseQty(line.quantity ?? null);
        if (!itemId || qty == null || qty === 0) continue;
        if (qty < 0) throw new Error("Counted quantity cannot be negative.");
        const row = await appendMovement(
          {
            itemId,
            delta: qty,
            reason: "OPENING",
            actorId: countedById,
            note: `Opening count · counted by ${countedName}`,
          },
          tx,
        );
        ids.push(row.id);
      }
      if (ids.length === 0) throw new Error("Count at least one item with a quantity.");
      return ids;
    });

    await lockDayOne(actorId, dayOne);
    return NextResponse.json({ locked: true, dayOne, movementIds: created }, { status: 201 });
  } catch (e) {
    return fromStoreError(e);
  }
}
