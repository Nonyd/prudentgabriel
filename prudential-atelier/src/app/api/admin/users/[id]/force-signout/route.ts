import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { forceAdminSignOut, jsonError } from "@/lib/admin-user-security";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireSuperAdminApi();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  const result = await forceAdminSignOut({
    actorId: gate.session.user.id!,
    actorEmail: gate.session.user.email,
    actorRole: gate.session.user.role,
    targetId: id,
  });
  if (!result.ok) return jsonError(result);
  return NextResponse.json({ success: true });
}
