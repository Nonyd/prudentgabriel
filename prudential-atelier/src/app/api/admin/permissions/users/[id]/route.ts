import { NextRequest, NextResponse } from "next/server";
import { PermissionMode, Role } from "@prisma/client";
import { z } from "zod";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { bumpPermissionCache } from "@/lib/permission-cache";
import { ADMIN_PERMISSION_CATALOG } from "@/lib/permission-catalog";
import { canEditTargetUserPermissions, filterEditablePermissions } from "@/lib/permission-policy";
import { logPermissionChange } from "@/lib/permission-log";
import {
  hasPermission,
  permissionSourceFor,
  seedRolePermissionSet,
  type AdminPermission,
} from "@/lib/roles";
import { serializePermissionSet } from "@/lib/permission-resolve";

const overrideSchema = z.object({
  permission: z.string(),
  mode: z.enum(["GRANT", "REVOKE"]),
});

const putSchema = z.union([
  z.object({ reset: z.literal(true) }),
  z.object({ overrides: z.array(overrideSchema) }),
]);

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireSuperAdminApi();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      userPermissions: { select: { permission: true, mode: true } },
    },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const grants = user.userPermissions.filter((p) => p.mode === "GRANT").map((p) => p.permission);
  const revokes = user.userPermissions.filter((p) => p.mode === "REVOKE").map((p) => p.permission);
  const rolePermissions = serializePermissionSet(seedRolePermissionSet(user.role));
  const actor = { email: user.email, grants, revokes };

  const items = ADMIN_PERMISSION_CATALOG.filter((e) => !e.superAdminOnly).map((entry) => ({
    key: entry.key,
    label: entry.label,
    description: entry.description,
    group: entry.group,
    effective: hasPermission(user.role, entry.key, actor),
    source: permissionSourceFor(user.role, entry.key, actor),
    fromRole: hasPermission(user.role, entry.key),
  }));

  return NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    rolePermissions,
    grants,
    revokes,
    items,
    editable: canEditTargetUserPermissions({
      actorId: gate.session.user.id,
      actorRole: gate.session.user.role,
      actorEmail: gate.session.user.email,
      targetId: user.id,
      targetRole: user.role,
    }),
  });
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireSuperAdminApi();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, role: true, name: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const allowed = canEditTargetUserPermissions({
    actorId: gate.session.user.id,
    actorRole: gate.session.user.role,
    actorEmail: gate.session.user.email,
    targetId: user.id,
    targetRole: user.role,
  });
  if (!allowed.ok) {
    return NextResponse.json({ error: allowed.reason }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const existing = await prisma.userPermission.findMany({
    where: { userId: id },
    select: { permission: true, mode: true },
  });
  const prev = new Map(existing.map((r) => [r.permission, r.mode]));

  if ("reset" in parsed.data) {
    await prisma.userPermission.deleteMany({ where: { userId: id } });
    await bumpPermissionCache();
    await logPermissionChange({
      session: gate.session,
      recordId: id,
      recordType: "User",
      description: `Reset ${user.email} to ${user.role} defaults (cleared ${existing.length} override(s)).`,
    });
    return NextResponse.json({ reset: true });
  }

  const nextRows = parsed.data.overrides.filter((o) =>
    filterEditablePermissions([o.permission]).includes(o.permission as AdminPermission),
  );

  await prisma.$transaction(async (tx) => {
    await tx.userPermission.deleteMany({ where: { userId: id } });
    if (nextRows.length > 0) {
      await tx.userPermission.createMany({
        data: nextRows.map((o) => ({
          userId: id,
          permission: o.permission,
          mode: o.mode as PermissionMode,
        })),
      });
    }
  });
  await bumpPermissionCache();

  const next = new Map(nextRows.map((o) => [o.permission, o.mode]));
  const keys = Array.from(prev.keys()).concat(Array.from(next.keys()));
  for (let i = 0; i < keys.length; i += 1) {
    const permission = keys[i]!;
    const from = prev.get(permission) ?? "off";
    const to = next.get(permission) ?? "off";
    if (from === to) continue;
    await logPermissionChange({
      session: gate.session,
      recordId: id,
      recordType: "User",
      description: `User ${user.email}: ${permission} ${from} → ${to} (role ${user.role as Role}).`,
    });
  }

  return NextResponse.json({ grants: nextRows.filter((o) => o.mode === "GRANT"), revokes: nextRows.filter((o) => o.mode === "REVOKE") });
}
