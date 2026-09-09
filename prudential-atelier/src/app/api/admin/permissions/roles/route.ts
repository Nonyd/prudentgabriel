import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import {
  ADMIN_PERMISSION_CATALOG,
  EDITABLE_ADMIN_ROLES,
  ROLE_PERMISSION_PROPOSALS,
} from "@/lib/permission-catalog";
import { isRolePermissionsEditable } from "@/lib/permission-policy";
import { ROLE_PERMISSIONS, seedRolePermissionSet } from "@/lib/roles";
import { serializePermissionSet } from "@/lib/permission-resolve";
import { displayRoleLabel } from "@/lib/admin-users";
import { commitRolePermissions } from "@/lib/permission-commit";

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

  try {
    const result = await commitRolePermissions({
      session: gate.session,
      role: parsed.data.role,
      permissions: parsed.data.permissions,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not save";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
