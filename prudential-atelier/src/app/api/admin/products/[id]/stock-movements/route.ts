import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-auth";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi("shop.products");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      variants: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          size: true,
          sku: true,
          stock: true,
          stockMovements: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              delta: true,
              reason: true,
              note: true,
              createdAt: true,
              orderId: true,
              actorId: true,
              actor: { select: { id: true, name: true, email: true } },
              order: { select: { id: true, orderNumber: true } },
            },
          },
        },
      },
    },
  });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(product);
}
