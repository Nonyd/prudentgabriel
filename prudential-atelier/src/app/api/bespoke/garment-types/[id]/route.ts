import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBespokeAccess } from "@/lib/atelier/bespoke-access";
import { logActivity } from "@/lib/logger";

/** Rename, reorder, retire or restore a garment type. Retired, not deleted: past commissions keep it. */
const patchSchema = z.object({
  label: z.string().trim().min(1).max(60).optional(),
  sortOrder: z.number().int().optional(),
  archived: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireBespokeAccess("manage");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const existing = await prisma.garmentType.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { archived, ...rest } = parsed.data;
  const item = await prisma.garmentType.update({
    where: { id },
    data: {
      ...rest,
      ...(archived === undefined ? {} : { archivedAt: archived ? (existing.archivedAt ?? new Date()) : null }),
    },
  });
  await logActivity({
    userId: gate.session.user.id,
    userEmail: gate.session.user.email ?? undefined,
    userRole: gate.session.user.role ?? undefined,
    action: "UPDATE",
    module: "bespoke",
    description: `Updated garment type "${item.label}"`,
    recordId: item.id,
    recordType: "GarmentType",
  });
  return NextResponse.json({ item });
}
