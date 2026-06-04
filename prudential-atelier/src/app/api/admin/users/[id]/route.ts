import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { INVITE_ROLES, MANAGED_STAFF_ROLES } from "@/lib/admin-users";
import { logActivity } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { isProtectedAccount } from "@/lib/roles";

const PROTECTED_MSG = "This account is protected and cannot be modified.";

const patchSchema = z.object({
  name: z.string().min(2).optional(),
  role: z
    .enum([
      "ADMIN",
      "STAFF_ADMIN",
      "BESPOKE_MANAGER",
      "RTW_MANAGER",
      "CONTENT_MANAGER",
      "FINANCE_MANAGER",
      "HR_MANAGER",
      "CONSULTATION_MANAGER",
      "STAFF",
    ])
    .optional(),
  isActive: z.boolean().optional(),
});

function serializeUser(user: {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  isActive: boolean;
  lastLogin: Date | null;
  createdAt: Date;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    lastLogin: user.lastLogin?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    isProtected: isProtectedAccount(user.email),
  };
}

async function getTarget(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      lastLogin: true,
      createdAt: true,
    },
  });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireSuperAdminApi();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  const target = await getTarget(id);
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (isProtectedAccount(target.email)) {
    return NextResponse.json({ error: PROTECTED_MSG }, { status: 403 });
  }

  if (gate.session.user.id === id) {
    return NextResponse.json({ error: "Cannot modify your own account here" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.role === undefined && parsed.data.name === undefined && parsed.data.isActive === undefined) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 });
  }

  if (target.role === Role.SUPER_ADMIN && parsed.data.role !== undefined) {
    return NextResponse.json({ error: "Super Admin role cannot be changed" }, { status: 400 });
  }

  if (parsed.data.role && !INVITE_ROLES.includes(parsed.data.role as Role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name.trim() } : {}),
      ...(parsed.data.role !== undefined ? { role: parsed.data.role as Role } : {}),
      ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      lastLogin: true,
      createdAt: true,
    },
  });

  await logActivity({
    userId: gate.session.user.id,
    userEmail: gate.session.user.email ?? undefined,
    userRole: gate.session.user.role,
    action: "UPDATE",
    module: "users",
    description: `Updated user ${updated.email}`,
    recordId: updated.id,
    recordType: "User",
  });

  return NextResponse.json({ user: serializeUser(updated) });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireSuperAdminApi();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  const target = await getTarget(id);
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (isProtectedAccount(target.email)) {
    return NextResponse.json({ error: PROTECTED_MSG }, { status: 403 });
  }

  if (gate.session.user.id === id) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  if (target.role === Role.SUPER_ADMIN) {
    const count = await prisma.user.count({ where: { role: Role.SUPER_ADMIN } });
    if (count <= 1) {
      return NextResponse.json({ error: "Cannot remove the last Super Admin" }, { status: 400 });
    }
  }

  if (!MANAGED_STAFF_ROLES.includes(target.role)) {
    return NextResponse.json({ error: "User is not a staff account" }, { status: 400 });
  }

  const activityCount = await prisma.activityLog.count({ where: { userId: id } });

  if (activityCount > 0) {
    const updated = await prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
      },
    });

    await logActivity({
      userId: gate.session.user.id,
      userEmail: gate.session.user.email ?? undefined,
      userRole: gate.session.user.role,
      action: "UPDATE",
      module: "users",
      description: `Deactivated user ${updated.email} (has activity history)`,
      recordId: updated.id,
      recordType: "User",
    });

    return NextResponse.json({ user: serializeUser(updated), softDeleted: true });
  }

  await prisma.user.delete({ where: { id } });

  await logActivity({
    userId: gate.session.user.id,
    userEmail: gate.session.user.email ?? undefined,
    userRole: gate.session.user.role,
    action: "DELETE",
    module: "users",
    description: `Removed user ${target.email}`,
    recordId: id,
    recordType: "User",
  });

  return NextResponse.json({ success: true, hardDeleted: true });
}
