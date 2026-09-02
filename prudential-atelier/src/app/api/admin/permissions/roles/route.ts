import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { bumpPermissionCache, peekRolePermissions } from "@/lib/permission-cache";
import {
  ADMIN_PERMISSION_CATALOG,
  EDITABLE_ADMIN_ROLES,
  ROLE_PERMISSION_PROPOSALS,
} from "@/lib/permission-catalog";
import { filterEditablePermissions, isRolePermissionsEditable } from "@/lib/permission-policy";
import { logPermissionChange } from "@/lib/permission-log";
import { ROLE_PERMISSIONS, seedRolePermissionSet } from "@/lib/roles";
import { serializePermissionSet } from "@/lib/permission-resolve";
import { displayRoleLabel } from "@/lib/admin-users";

export async function GET() {
  const gate = await requireSuperAdminApi();
  if (!gate.ok) return gate.response;

  const roles = ["SUPER_ADMIN", ...EDITABLE_ADMIN_ROLES] as const;
  const counts = await prisma.user.groupBy({
    by: ["role"],
    _count: { _all: true },
    where: { role: { in: [...roles] as Role[] } },
  });
  const countMap = new Map(counts.map((c) => [c.role, c._count._all]));

  const rows = await prisma.rolePermission.findMany({
    select: { role: true, permission: true },
  });
  const grouped = new Map<string, string[]>();
  for (const row of rows) {
    const list = grouped.get(row.role) ?? [];
    list.push(row.permission);
    grouped.set(row.role, list);
  }

  const items = roles.map((role) => {
    const stored = grouped.get(role);
    const seed = serializePermissionSet(seedRolePermissionSet(role));
    const permissions = role === "SUPER_ADMIN" ? ("*" as const) : stored && stored.length > 0 ? stored.sort() : seed;
    const memberCount = countMap.get(role as Role) ?? 0;
    const current = new Set(permissions === "*" ? [] : permissions);
    const proposals = ROLE_PERMISSION_PROPOSALS.filter(
      (p) => p.role === role && p.add.some((perm) => !current.has(perm)),
    );
    return {
      role,
      label: displayRoleLabel(role),
      memberCount,
      permissions,
      editable: isRolePermissionsEditable(role),
      proposals,
    };
  });

  return NextResponse.json({
    items,
    catalog: ADMIN_PERMISSION_CATALOG,
    baseline: ROLE_PERMISSIONS,
  });
}

const putSchema = z.object({
  role: z.string(),
  permissions: z.array(z.string()),
});

export async function PUT(req: NextRequest) {
  const gate = await requireSuperAdminApi();
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => null);
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const role = parsed.data.role;
  if (!isRolePermissionsEditable(role)) {
    return NextResponse.json({ error: "This role cannot be edited." }, { status: 400 });
  }

  const next = new Set<string>(filterEditablePermissions(parsed.data.permissions));
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
      session: gate.session,
      recordId: role,
      recordType: "Role",
      description: `Granted ${permission} to role ${role} (was off). ${memberCount} account(s) on this role.`,
    });
  }
  for (const permission of removed) {
    await logPermissionChange({
      session: gate.session,
      recordId: role,
      recordType: "Role",
      description: `Removed ${permission} from role ${role} (was on). ${memberCount} account(s) on this role.`,
    });
  }

  return NextResponse.json({
    role,
    permissions: peekRolePermissions(role) ?? Array.from(next),
    added,
    removed,
    memberCount,
  });
}
