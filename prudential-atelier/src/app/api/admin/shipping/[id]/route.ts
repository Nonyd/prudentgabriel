import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-auth";
import { z } from "zod";

const zoneSchema = z.object({
  name: z.string().min(2).optional(),
  countries: z.array(z.string()).optional(),
  states: z.array(z.string()).optional(),
  flatRateNGN: z.number().min(0).optional(),
  perKgNGN: z.number().min(0).optional(),
  freeAboveNGN: z.number().optional().nullable(),
  estimatedDays: z.string().optional(),
  isActive: z.boolean().optional(),
});

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
  const parsed = zoneSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const zone = await prisma.shippingZone.update({ where: { id }, data: parsed.data });
  return NextResponse.json(zone);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  await prisma.shippingZone.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
