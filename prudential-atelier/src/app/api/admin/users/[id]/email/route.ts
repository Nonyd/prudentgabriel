import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { changeUserEmail } from "@/lib/admin-email-change";
import { getClientIp } from "@/lib/rate-limit";

/** Change any account's sign-in email (client, staff or admin). Super Admin only. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireSuperAdminApi();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => null)) as { email?: unknown } | null;
  const result = await changeUserEmail({
    targetUserId: id,
    nextEmail: body?.email,
    actor: { id: gate.session.user.id!, email: gate.session.user.email, role: gate.session.user.role },
    ip: getClientIp(req),
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, changed: result.changed, email: result.newEmail });
}
