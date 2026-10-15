import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-auth";

const patchSchema = z.object({
  name: z.string().trim().min(2).optional(),
  address: z.string().trim().min(3).optional(),
  hours: z.string().trim().min(1).optional(),
  instructions: z.string().trim().optional().nullable(),
  isActive: z.boolean().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const gate = await requireAdminApi("shop");
  if (!gate.ok) return gate.response;
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.pickupLocation.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { instructions, ...rest } = parsed.data;
  const loc = await prisma.pickupLocation.update({
    where: { id },
    data: {
      ...rest,
      ...(instructions !== undefined ? { instructions: instructions || null } : {}),
    },
  });
  return NextResponse.json(loc);
}

/**
 * Orders keep a reference to where they were collected, so a location that has
 * been used is hidden from checkout instead of removed.
 */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const gate = await requireAdminApi("shop");
  if (!gate.ok) return gate.response;
  const { id } = await params;

  const existing = await prisma.pickupLocation.findUnique({
    where: { id },
    select: { id: true, _count: { select: { orders: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (existing._count.orders > 0) {
    await prisma.pickupLocation.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ deleted: false, deactivated: true, orders: existing._count.orders });
  }

  await prisma.pickupLocation.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
