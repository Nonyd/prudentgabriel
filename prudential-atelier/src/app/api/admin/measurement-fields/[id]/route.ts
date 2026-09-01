import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-auth";

const patchSchema = z.object({
  label: z.string().min(1).max(80).optional(),
  helpText: z.string().max(400).optional().nullable(),
  minCm: z.number().positive().optional().nullable(),
  maxCm: z.number().positive().optional().nullable(),
  sortOrder: z.number().int().optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi("shop.products");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const item = await prisma.measurementField.update({ where: { id }, data: parsed.data });
  return NextResponse.json(item);
}
