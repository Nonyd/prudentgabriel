import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { OrderStatus } from "@prisma/client";

const bodySchema = z.object({
  productId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(200).optional(),
  body: z.string().min(10).max(5000),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { productId, rating, title, body } = parsed.data;

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const order = await prisma.order.findFirst({
    where: {
      userId: session.user.id,
      status: { notIn: [OrderStatus.CANCELLED, OrderStatus.REFUNDED] },
      items: { some: { productId } },
    },
    select: { id: true },
  });

  await prisma.review.create({
    data: {
      userId: session.user.id,
      productId,
      rating,
      title: title ?? null,
      body,
      isVerified: Boolean(order),
      isApproved: false,
      orderId: order?.id ?? null,
    },
  });

  return NextResponse.json({ success: true });
}
