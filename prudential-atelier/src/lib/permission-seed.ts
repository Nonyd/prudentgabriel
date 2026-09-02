import type { PrismaClient, Role } from "@prisma/client";
import { ROLE_PERMISSIONS } from "@/lib/roles";

/** Insert missing RolePermission rows from ROLE_PERMISSIONS. Never writes SUPER_ADMIN. */
export async function seedRolePermissionsFromBaseline(db: PrismaClient): Promise<number> {
  let created = 0;
  for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
    if (role === "SUPER_ADMIN" || perms[0] === "*") continue;
    for (const permission of perms as readonly string[]) {
      const result = await db.rolePermission.upsert({
        where: { role_permission: { role: role as Role, permission } },
        create: { role: role as Role, permission },
        update: {},
      });
      if (result) created += 1;
    }
  }
  await db.permissionCacheState.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", revision: 0 },
    update: {},
  });
  return created;
}
