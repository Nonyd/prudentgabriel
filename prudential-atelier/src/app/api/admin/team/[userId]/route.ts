import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { isGeneralAdminAccount, isSuperAdminAccount } from "@/lib/roles";

const patchSchema = z.object({
  role: z.enum(["ADMIN", "SUPER_ADMIN", "STAFF_ADMIN"]),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ userId: string }> }) {
  const gate = await requireSuperAdminApi();
  if (!gate.ok) return gate.response;

  const { userId } = await ctx.params;
  if (gate.session.user.id === userId) {
    return NextResponse.json({ error: "Cannot change own role" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, email: true },
  });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (isSuperAdminAccount(target.email)) {
    return NextResponse.json({ error: "Super Admin account cannot be modified" }, { status: 403 });
  }
  if (isGeneralAdminAccount(target.email)) {
    return NextResponse.json({ error: "General Admin account is protected" }, { status: 403 });
  }

  if (target.role === "SUPER_ADMIN" && parsed.data.role !== "SUPER_ADMIN") {
    const count = await prisma.user.count({ where: { role: "SUPER_ADMIN" } });
    if (count <= 1) {
      return NextResponse.json({ error: "Cannot demote last SUPER_ADMIN" }, { status: 400 });
    }
  }

  await prisma.user.update({ where: { id: userId }, data: { role: parsed.data.role } });
  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ userId: string }> }) {
  const gate = await requireSuperAdminApi();
  if (!gate.ok) return gate.response;

  const { userId } = await ctx.params;
  if (gate.session.user.id === userId) {
    return NextResponse.json({ error: "Cannot remove self" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, email: true },
  });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (isSuperAdminAccount(target.email)) {
    return NextResponse.json({ error: "Super Admin account cannot be removed" }, { status: 403 });
  }
  if (isGeneralAdminAccount(target.email)) {
    return NextResponse.json({ error: "General Admin account is protected" }, { status: 403 });
  }

  if (target.role === "SUPER_ADMIN") {
    const count = await prisma.user.count({ where: { role: "SUPER_ADMIN" } });
    if (count <= 1) {
      return NextResponse.json({ error: "Cannot remove last SUPER_ADMIN" }, { status: 400 });
    }
  }

  await prisma.user.update({ where: { id: userId }, data: { role: "CUSTOMER" } });
  return NextResponse.json({ success: true });
}
