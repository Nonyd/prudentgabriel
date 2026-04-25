import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const gate = await requireSuperAdminApi();
  if (!gate.ok) return gate.response;

  const { token } = await ctx.params;
  await prisma.teamInvitation.deleteMany({ where: { token } });
  return NextResponse.json({ success: true });
}
