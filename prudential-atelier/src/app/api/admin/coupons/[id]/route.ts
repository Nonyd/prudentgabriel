import { NextRequest, NextResponse } from "next/server";
import { ProductCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-auth";
import { couponAdminSchema } from "@/validations/coupon";
import { z } from "zod";

const toggleSchema = z.object({ isActive: z.boolean() });

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const toggle = toggleSchema.safeParse(body);
  if (toggle.success) {
    const c = await prisma.coupon.update({
      where: { id },
      data: { isActive: toggle.data.isActive },
    });
    return NextResponse.json(c);
  }

  const parsed = couponAdminSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;
  const scope =
    d.categoryScope?.map((c) => c as ProductCategory).filter((c) => (Object.values(ProductCategory) as string[]).includes(c)) ??
    undefined;

  const c = await prisma.coupon.update({
    where: { id },
    data: {
      ...(d.description !== undefined ? { description: d.description } : {}),
      ...(d.value !== undefined ? { value: d.value } : {}),
      ...(d.minOrderNGN !== undefined ? { minOrderNGN: d.minOrderNGN } : {}),
      ...(d.maxUsesTotal !== undefined ? { maxUsesTotal: d.maxUsesTotal } : {}),
      ...(d.maxUsesPerUser !== undefined ? { maxUsesPerUser: d.maxUsesPerUser } : {}),
      ...(d.appliesToAll !== undefined ? { appliesToAll: d.appliesToAll } : {}),
      ...(scope !== undefined ? { categoryScope: scope } : {}),
      ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
      ...(d.startsAt !== undefined ? { startsAt: d.startsAt } : {}),
      ...(d.expiresAt !== undefined ? { expiresAt: d.expiresAt } : {}),
    },
  });
  return NextResponse.json(c);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  const used = await prisma.couponUsage.count({ where: { couponId: id } });
  if (used > 0) {
    await prisma.coupon.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ ok: true, soft: true });
  }
  await prisma.coupon.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
