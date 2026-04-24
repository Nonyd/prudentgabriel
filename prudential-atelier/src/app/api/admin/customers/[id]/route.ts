import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminApi, requireSuperAdminApi } from "@/lib/admin-auth";
import { z } from "zod";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  const user = await prisma.user.findFirst({
    where: { id, role: Role.CUSTOMER },
    include: {
      orders: { orderBy: { createdAt: "desc" }, take: 10, include: { _count: { select: { items: true } } } },
      pointsHistory: { orderBy: { createdAt: "desc" }, take: 20 },
      referrals: { take: 20, include: { _count: { select: { orders: true } } } },
      addresses: true,
    },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(user);
}

const patchSchema = z.object({ role: z.enum([Role.CUSTOMER, Role.ADMIN]) });

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireSuperAdminApi();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const u = await prisma.user.update({
    where: { id },
    data: { role: parsed.data.role },
  });
  return NextResponse.json(u);
}
