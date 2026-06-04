import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireGeneralAdminApi } from "@/lib/admin-auth";
import { ensurePresetJobRoles, listJobRoles } from "@/lib/job-roles";
import { logActivity } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  permissions: z.array(z.string()).default([]),
});

export async function GET(req: NextRequest) {
  const gate = await requireGeneralAdminApi();
  if (!gate.ok) return gate.response;

  const seed = req.nextUrl.searchParams.get("seed") === "1";
  if (seed) {
    await ensurePresetJobRoles(gate.session.user.id);
  } else {
    const presetCount = await prisma.jobRole.count({ where: { isPreset: true } });
    if (presetCount === 0) {
      await ensurePresetJobRoles(gate.session.user.id);
    }
  }

  const items = await listJobRoles();
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const gate = await requireGeneralAdminApi();
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const duplicate = await prisma.jobRole.findFirst({
    where: { name: { equals: parsed.data.name.trim(), mode: "insensitive" } },
  });
  if (duplicate) {
    return NextResponse.json({ error: "A role with this name already exists" }, { status: 409 });
  }

  const role = await prisma.jobRole.create({
    data: {
      name: parsed.data.name.trim(),
      description: parsed.data.description?.trim() || null,
      permissions: parsed.data.permissions,
      isPreset: false,
      createdBy: gate.session.user.id,
    },
    include: { _count: { select: { users: true } } },
  });

  await logActivity({
    userId: gate.session.user.id,
    userEmail: gate.session.user.email ?? undefined,
    userRole: gate.session.user.role,
    action: "CREATE",
    module: "job_roles",
    description: `Created job role ${role.name}`,
    recordId: role.id,
    recordType: "JobRole",
  });

  return NextResponse.json(
    {
      role: {
        id: role.id,
        name: role.name,
        description: role.description,
        isPreset: role.isPreset,
        permissions: role.permissions,
        staffCount: role._count.users,
        permissionCount: role.permissions.length,
      },
    },
    { status: 201 },
  );
}
