import { NextRequest, NextResponse } from "next/server";
import { Prisma, StoreLine } from "@prisma/client";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { fromStoreError, jsonError, num } from "@/lib/store/http";
import { onHandByItemIds } from "@/lib/store/ledger";

const LINES = new Set<string>(Object.values(StoreLine));

export async function GET(req: NextRequest) {
  const gate = await requireAdminApi(["store", "bespoke"]);
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(req.url);
  const inactive = searchParams.get("inactive") === "1";
  const items = await prisma.storeItem.findMany({
    where: inactive ? {} : { isActive: true },
    orderBy: { name: "asc" },
    include: { category: { select: { id: true, name: true, sortOrder: true } } },
  });
  const qty = await onHandByItemIds(items.map((i) => i.id));
  return NextResponse.json({
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      unit: item.unit,
      spec: item.spec,
      supplier: item.supplier,
      unitCost: num(item.unitCost),
      storeLine: item.storeLine,
      isActive: item.isActive,
      categoryId: item.categoryId,
      categoryName: item.category.name,
      onHand: qty.get(item.id) ?? 0,
    })),
  });
}

export async function POST(req: NextRequest) {
  const gate = await requireAdminApi("store");
  if (!gate.ok) return gate.response;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON");
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const unit = typeof body.unit === "string" ? body.unit.trim() : "";
  const categoryId = typeof body.categoryId === "string" ? body.categoryId : "";
  if (!name || !unit || !categoryId) return jsonError("Name, unit, and category are required.");

  const storeLine = typeof body.storeLine === "string" && LINES.has(body.storeLine) ? (body.storeLine as StoreLine) : StoreLine.SHARED;
  const unitCost = typeof body.unitCost === "number" && Number.isFinite(body.unitCost) ? body.unitCost : null;

  try {
    const item = await prisma.storeItem.create({
      data: {
        name,
        unit,
        categoryId,
        spec: typeof body.spec === "string" ? body.spec.trim() || null : null,
        supplier: typeof body.supplier === "string" ? body.supplier.trim() || null : null,
        unitCost: unitCost != null ? new Prisma.Decimal(unitCost) : null,
        storeLine,
      },
      include: { category: { select: { id: true, name: true } } },
    });
    return NextResponse.json(
      {
        item: {
          ...item,
          unitCost: num(item.unitCost),
          categoryName: item.category.name,
          onHand: 0,
        },
      },
      { status: 201 },
    );
  } catch (e) {
    return fromStoreError(e);
  }
}
