import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-auth";

const lagosSchema = z.object({
  name: z.string().min(2).optional(),
  price: z.number().min(0).optional(),
  freeAboveNGN: z.number().min(0).optional().nullable(),
  etaText: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi("settings");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = lagosSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.lagosLocation.findUnique({ where: { id } });
  if (existing) {
    const loc = await prisma.lagosLocation.update({ where: { id }, data: parsed.data });
    return NextResponse.json(loc);
  }

  const pickup = await prisma.pickupLocation.findUnique({ where: { id } });
  if (pickup) {
    const pickupSchema = z.object({
      name: z.string().min(2).optional(),
      address: z.string().min(3).optional(),
      hours: z.string().min(1).optional(),
      instructions: z.string().optional().nullable(),
      isActive: z.boolean().optional(),
    });
    const p = pickupSchema.safeParse(body);
    if (!p.success) return NextResponse.json({ error: p.error.flatten() }, { status: 400 });
    const row = await prisma.pickupLocation.update({ where: { id }, data: p.data });
    return NextResponse.json(row);
  }

  const method = await prisma.shippingMethod.findUnique({ where: { id } });
  if (method) {
    const methodSchema = z.object({
      name: z.string().min(2).optional(),
      description: z.string().optional().nullable(),
      isActive: z.boolean().optional(),
      markupKind: z.enum(["PERCENT", "FLAT"]).optional().nullable(),
      markupValue: z.number().min(0).optional().nullable(),
      defaultService: z.string().optional().nullable(),
    });
    const m = methodSchema.safeParse(body);
    if (!m.success) return NextResponse.json({ error: m.error.flatten() }, { status: 400 });
    const row = await prisma.shippingMethod.update({ where: { id }, data: m.data });
    return NextResponse.json(row);
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi("settings");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  const loc = await prisma.lagosLocation.findUnique({ where: { id } });
  if (loc) {
    const active = await prisma.order.findFirst({
      where: { lagosLocationId: id, status: { in: ["PENDING", "CONFIRMED", "PROCESSING"] } },
      select: { id: true },
    });
    if (active) {
      return NextResponse.json({ error: "Cannot delete — active orders use this location" }, { status: 409 });
    }
    await prisma.lagosLocation.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }

  const pickup = await prisma.pickupLocation.findUnique({ where: { id } });
  if (pickup) {
    const active = await prisma.order.findFirst({
      where: { pickupLocationId: id, status: { in: ["PENDING", "CONFIRMED", "PROCESSING", "READY_FOR_COLLECTION"] } },
      select: { id: true },
    });
    if (active) {
      return NextResponse.json({ error: "Cannot delete — active orders use this pickup" }, { status: 409 });
    }
    await prisma.pickupLocation.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
