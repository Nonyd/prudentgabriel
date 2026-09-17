import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/store/http";
import { parseQty } from "@/lib/store/qty";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const gate = await requireAdminApi(["shop.products", "store"]);
  if (!gate.ok) return gate.response;
  const { id: productId } = await params;
  const items = await prisma.productMaterial.findMany({
    where: { productId },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: {
      item: { select: { id: true, name: true, unit: true } },
      productOption: { select: { id: true, label: true } },
    },
  });
  return NextResponse.json({
    items: items.map((m) => ({
      id: m.id,
      itemId: m.itemId,
      itemName: m.item.name,
      unit: m.unit,
      quantityPerUnit: Number(m.quantityPerUnit),
      isOptional: m.isOptional,
      productOptionId: m.productOptionId,
      productOptionLabel: m.productOption?.label ?? null,
      sortOrder: m.sortOrder,
    })),
  });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const gate = await requireAdminApi("shop.products");
  if (!gate.ok) return gate.response;
  const { id: productId } = await params;

  let body: {
    lines?: {
      itemId?: string;
      productOptionId?: string | null;
      quantityPerUnit?: string | number;
      unit?: string;
      isOptional?: boolean;
    }[];
  };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON");
  }

  const lines = Array.isArray(body.lines) ? body.lines : [];
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) return jsonError("Product not found", 404);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.productMaterial.deleteMany({ where: { productId } });
      let sort = 0;
      for (const line of lines) {
        if (!line.itemId) continue;
        const qty = parseQty(line.quantityPerUnit ?? null);
        if (qty == null || qty <= 0) throw new Error("Each material needs a positive quantity per unit.");
        await tx.productMaterial.create({
          data: {
            productId,
            itemId: line.itemId,
            productOptionId: line.productOptionId || null,
            quantityPerUnit: new Prisma.Decimal(qty),
            unit: (line.unit || "yard").trim(),
            isOptional: Boolean(line.isOptional),
            sortOrder: sort++,
          },
        });
      }
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Could not save materials", 400);
  }
}
