import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireGeneralAdminApi } from "@/lib/admin-auth";
import { logActivity } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().nullable().optional(),
  permissions: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireGeneralAdminApi();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.jobRole.findUnique({
    where: { id },
    include: { _count: { select: { users: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (parsed.data.name && parsed.data.name.trim() !== existing.name) {
    const duplicate = await prisma.jobRole.findFirst({
      where: {
        name: { equals: parsed.data.name.trim(), mode: "insensitive" },
        id: { not: id },
      },
    });
    if (duplicate) {
      return NextResponse.json({ error: "A role with this name already exists" }, { status: 409 });
    }
  }

  const role = await prisma.jobRole.update({
    where: { id },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name.trim() } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      ...(parsed.data.permissions !== undefined ? { permissions: parsed.data.permissions } : {}),
      ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
    },
    include: { _count: { select: { users: true } } },
  });

  await logActivity({
    userId: gate.session.user.id,
    userEmail: gate.session.user.email ?? undefined,
    userRole: gate.session.user.role,
    action: "UPDATE",
    module: "job_roles",
    description: `Updated job role ${role.name}`,
    recordId: role.id,
    recordType: "JobRole",
  });

  return NextResponse.json({
    role: {
      id: role.id,
      name: role.name,
      description: role.description,
      isPreset: role.isPreset,
      permissions: role.permissions,
      staffCount: role._count.users,
      permissionCount: role.permissions.length,
    },
  });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireGeneralAdminApi();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  const existing = await prisma.jobRole.findUnique({
    where: { id },
    include: { _count: { select: { users: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (existing._count.users > 0) {
    return NextResponse.json(
      { error: "Cannot delete a role that has staff assigned" },
      { status: 409 },
    );
  }

  await prisma.jobRole.delete({ where: { id } });

  await logActivity({
    userId: gate.session.user.id,
    userEmail: gate.session.user.email ?? undefined,
    userRole: gate.session.user.role,
    action: "DELETE",
    module: "job_roles",
    description: `Deleted job role ${existing.name}`,
    recordId: id,
    recordType: "JobRole",
  });

  return NextResponse.json({ ok: true });
}
