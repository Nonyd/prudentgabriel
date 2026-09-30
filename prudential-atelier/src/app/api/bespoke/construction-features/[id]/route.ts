import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { BESPOKE_MANAGER_ROLES, requireRoles } from "@/lib/api-auth";
import { logActivity } from "@/lib/logger";

/**
 * Rename, regroup, reorder, retire or restore a feature. The key never changes,
 * and a feature is retired rather than deleted so past commissions keep it.
 */
const patchSchema = z.object({
  label: z.string().trim().min(1).max(80).optional(),
  group: z.string().trim().max(40).optional().nullable(),
  helpText: z.string().trim().max(400).optional().nullable(),
  sortOrder: z.number().int().optional(),
  archived: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireRoles(BESPOKE_MANAGER_ROLES);
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const existing = await prisma.constructionFeature.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { archived, group, helpText, ...rest } = parsed.data;
  const item = await prisma.constructionFeature.update({
    where: { id },
    data: {
      ...rest,
      ...(group !== undefined ? { group: group || null } : {}),
      ...(helpText !== undefined ? { helpText: helpText || null } : {}),
      ...(archived === undefined ? {} : { archivedAt: archived ? (existing.archivedAt ?? new Date()) : null }),
    },
  });
  await logActivity({
    userId: gate.session.user.id,
    userEmail: gate.session.user.email ?? undefined,
    userRole: gate.session.user.role ?? undefined,
    action: "UPDATE",
    module: "bespoke",
    description: `Updated construction feature "${item.label}"`,
    recordId: item.id,
    recordType: "ConstructionFeature",
  });
  return NextResponse.json({ item });
}
