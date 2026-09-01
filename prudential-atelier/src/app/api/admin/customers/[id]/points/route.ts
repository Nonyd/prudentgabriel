import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-auth";
import { adjustPointsAdmin, InsufficientPointsError } from "@/lib/points";
import { z } from "zod";

const bodySchema = z.object({
  amount: z.number().int().refine((n) => n !== 0, "Amount must be non-zero"),
  description: z.string().trim().min(1, "A reason is required"),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi("clients");
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

  try {
    const pointsBalance = await prisma.$transaction((tx) =>
      adjustPointsAdmin({
        userId: id,
        delta: parsed.data.amount,
        reason: parsed.data.description,
        db: tx,
      }),
    );
    return NextResponse.json({ ok: true, pointsBalance });
  } catch (e) {
    if (e instanceof InsufficientPointsError) {
      return NextResponse.json({ error: "Insufficient points" }, { status: 400 });
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not adjust points" }, { status: 400 });
  }
}
