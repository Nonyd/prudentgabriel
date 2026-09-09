import { Role } from "@prisma/client";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { bumpPermissionCache, peekRolePermissions } from "@/lib/permission-cache";
import { filterEditablePermissions, isRolePermissionsEditable } from "@/lib/permission-policy";
import { logPermissionChange } from "@/lib/permission-log";
import { seedRolePermissionSet } from "@/lib/roles";

export async function commitRolePermissions(params: {
  session: Session;
  role: string;
  permissions: string[];
}): Promise<{
  role: string;
  added: string[];
  removed: string[];
  memberCount: number;
  permissions: string[] | "*";
}> {
  const role = params.role;
  if (!isRolePermissionsEditable(role)) {
    throw new Error("This role cannot be edited.");
  }

  const next = new Set<string>(filterEditablePermissions(params.permissions));
  const existing = await prisma.rolePermission.findMany({
    where: { role: role as Role },
    select: { permission: true },
  });
  const prev = new Set(existing.map((r) => r.permission));
  if (prev.size === 0) {
    const seed = seedRolePermissionSet(role);
    if (seed !== "*") Array.from(seed).forEach((p) => prev.add(p));
  }

  const added = Array.from(next).filter((p) => !prev.has(p));
  const removed = Array.from(prev).filter((p) => !next.has(p));

  await prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { role: role as Role } });
    if (next.size > 0) {
      await tx.rolePermission.createMany({
        data: Array.from(next).map((permission) => ({ role: role as Role, permission })),
      });
    }
  });

  await bumpPermissionCache();

  const memberCount = await prisma.user.count({ where: { role: role as Role } });
  for (const permission of added) {
    await logPermissionChange({
      session: params.session,
      recordId: role,
      recordType: "Role",
      description: `Granted ${permission} to role ${role} (was off). ${memberCount} account(s) on this role.`,
    });
  }
  for (const permission of removed) {
    await logPermissionChange({
      session: params.session,
      recordId: role,
      recordType: "Role",
      description: `Removed ${permission} from role ${role} (was on). ${memberCount} account(s) on this role.`,
    });
  }

  return {
    role,
    added,
    removed,
    memberCount,
    permissions: (peekRolePermissions(role) ?? Array.from(next)) as string[] | "*",
  };
}
