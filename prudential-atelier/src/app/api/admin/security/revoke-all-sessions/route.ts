import { NextRequest, NextResponse } from "next/server";
import { ActivityAction } from "@prisma/client";
import { requireRoles } from "@/lib/api-auth";
import { logActivity } from "@/lib/logger";
import { getClientIp } from "@/lib/rate-limit";
import { REVOKE_ALL_CONFIRMATION, getSessionsRevokedAt, revokeAllSessions } from "@/lib/session-revocation";

/**
 * Slice AZ9 — SUPER_ADMIN only. Signs every account out, including the caller.
 * The request must carry the typed confirmation; every use is logged.
 */
export async function POST(req: NextRequest) {
  const gate = await requireRoles(["SUPER_ADMIN"]);
  if (!gate.ok) return gate.response;

  const body = (await req.json().catch(() => null)) as { confirm?: unknown } | null;
  if (body?.confirm !== REVOKE_ALL_CONFIRMATION) {
    return NextResponse.json(
      { error: `Type "${REVOKE_ALL_CONFIRMATION}" to confirm.` },
      { status: 400 },
    );
  }

  const user = gate.session.user;
  const revokedAt = await revokeAllSessions(user.email ?? user.id ?? "unknown");
  await logActivity({
    userId: user.id,
    userEmail: user.email ?? undefined,
    userRole: user.role ?? undefined,
    action: ActivityAction.LOGOUT,
    module: "security",
    description: `Signed out every account (all sessions issued before ${revokedAt.toISOString()}).`,
    ipAddress: getClientIp(req),
  });
  return NextResponse.json({ revokedAt: revokedAt.toISOString() });
}

export async function GET() {
  const gate = await requireRoles(["SUPER_ADMIN"]);
  if (!gate.ok) return gate.response;
  const at = await getSessionsRevokedAt();
  return NextResponse.json({ revokedAt: at?.toISOString() ?? null });
}
