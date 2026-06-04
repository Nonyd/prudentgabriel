import { prisma } from "@/lib/prisma";
import { ROLE_PRESETS } from "@/lib/permissions";

export async function ensurePresetJobRoles(createdBy?: string): Promise<number> {
  const existing = await prisma.jobRole.count({ where: { isPreset: true } });
  if (existing >= Object.keys(ROLE_PRESETS).length) return 0;

  let created = 0;
  for (const preset of Object.values(ROLE_PRESETS)) {
    const found = await prisma.jobRole.findFirst({
      where: { name: preset.name, isPreset: true },
    });
    if (found) continue;
    await prisma.jobRole.create({
      data: {
        name: preset.name,
        description: preset.description,
        permissions: preset.permissions,
        isPreset: true,
        isActive: true,
        createdBy: createdBy ?? null,
      },
    });
    created += 1;
  }
  return created;
}

export async function listJobRoles() {
  const roles = await prisma.jobRole.findMany({
    where: { isActive: true },
    orderBy: [{ isPreset: "desc" }, { name: "asc" }],
    include: { _count: { select: { users: true } } },
  });
  return roles.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    isPreset: r.isPreset,
    isActive: r.isActive,
    permissions: r.permissions,
    staffCount: r._count.users,
    permissionCount: r.permissions.length,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}
