import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

/** By row id: the token column is a hash, and no screen ever holds it. */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireSuperAdminApi();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  const { count } = await prisma.teamInvitation.deleteMany({ where: { id, acceptedAt: null } });
  if (count === 0) return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
