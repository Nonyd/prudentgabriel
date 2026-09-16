import { NextRequest, NextResponse } from "next/server";
import { Prisma, StoreLine } from "@prisma/client";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { fromStoreError, jsonError, num } from "@/lib/store/http";
import { onHand } from "@/lib/store/ledger";

const LINES = new Set<string>(Object.values(StoreLine));

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const gate = await requireAdminApi("store");
  if (!gate.ok) return gate.response;
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON");
  }

  const data: Prisma.StoreItemUpdateInput = {};
  if (typeof body.name === "string") data.name = body.name.trim();
  if (typeof body.unit === "string") data.unit = body.unit.trim();
  if (typeof body.spec === "string") data.spec = body.spec.trim() || null;
  if (typeof body.supplier === "string") data.supplier = body.supplier.trim() || null;
  if (typeof body.categoryId === "string") data.category = { connect: { id: body.categoryId } };
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (typeof body.storeLine === "string" && LINES.has(body.storeLine)) {
    data.storeLine = body.storeLine as StoreLine;
  }
  if (body.unitCost === null) data.unitCost = null;
  if (typeof body.unitCost === "number" && Number.isFinite(body.unitCost)) {
    data.unitCost = new Prisma.Decimal(body.unitCost);
  }

  try {
    const item = await prisma.storeItem.update({
      where: { id },
      data,
      include: { category: { select: { id: true, name: true } } },
    });
    return NextResponse.json({
      item: {
        ...item,
        unitCost: num(item.unitCost),
        categoryName: item.category.name,
        onHand: await onHand(item.id),
      },
    });
  } catch (e) {
    return fromStoreError(e);
  }
}
