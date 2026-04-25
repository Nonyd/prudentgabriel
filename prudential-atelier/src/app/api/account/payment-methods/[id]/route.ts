import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  isDefault: z.boolean().optional(),
  nickname: z.string().max(100).optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.savedPaymentMethod.findFirst({ where: { id, userId: session.user.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (parsed.data.isDefault) {
    await prisma.$transaction([
      prisma.savedPaymentMethod.updateMany({
        where: { userId: session.user.id, id: { not: id } },
        data: { isDefault: false },
      }),
      prisma.savedPaymentMethod.update({
        where: { id },
        data: {
          isDefault: true,
          ...(parsed.data.nickname !== undefined ? { nickname: parsed.data.nickname || null } : {}),
        },
      }),
    ]);
  } else {
    await prisma.savedPaymentMethod.update({
      where: { id },
      data: {
        ...(parsed.data.nickname !== undefined ? { nickname: parsed.data.nickname || null } : {}),
      },
    });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const existing = await prisma.savedPaymentMethod.findFirst({ where: { id, userId: session.user.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (existing.gateway === "STRIPE" && existing.stripePaymentMethodId) {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (stripeKey) {
      const stripe = new Stripe(stripeKey);
      await stripe.paymentMethods.detach(existing.stripePaymentMethodId).catch(() => null);
    }
  }

  await prisma.savedPaymentMethod.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
