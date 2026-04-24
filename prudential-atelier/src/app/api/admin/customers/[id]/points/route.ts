import { NextRequest, NextResponse } from "next/server";
import { PointsType, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-auth";
import { z } from "zod";

const bodySchema = z.object({
  amount: z.number().int(),
  description: z.string().min(1),
  type: z.literal("ADJUSTED_ADMIN"),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const user = await prisma.user.findFirst({ where: { id, role: Role.CUSTOMER } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const delta = parsed.data.amount;
  const nextBalance = Math.max(0, user.pointsBalance + delta);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: { pointsBalance: nextBalance },
    });
    await tx.pointsTransaction.create({
      data: {
        userId: id,
        type: PointsType.ADJUSTED_ADMIN,
        amount: delta,
        balanceAfter: nextBalance,
        description: parsed.data.description,
      },
    });
  });

  return NextResponse.json({ ok: true, pointsBalance: nextBalance });
}
