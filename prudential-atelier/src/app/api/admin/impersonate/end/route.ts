import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  ADMIN_IMPERSONATE_COOKIE,
  impersonationCookieOptions,
  parseImpersonationCookie,
} from "@/lib/admin-impersonate";
import { logActivity } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Ends "View as" and goes back to the admin. The admin layout sends the Super
 * Admin here when her cookie names someone who cannot open the admin, so a
 * "View as" of a staff member ends instead of looping to the sign-in page.
 * Only ever ends a view; it cannot start one.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  const existing = parseImpersonationCookie(req.cookies.get(ADMIN_IMPERSONATE_COOKIE)?.value);
  const res = NextResponse.redirect(new URL(session?.user ? "/admin" : "/login?tab=admin", req.url));
  res.cookies.set(ADMIN_IMPERSONATE_COOKIE, "", impersonationCookieOptions(0));
  if (session?.user && existing) {
    await logActivity({
      userId: session.user.id,
      userEmail: session.user.email ?? undefined,
      userRole: session.user.role,
      action: "UPDATE",
      module: "impersonation",
      description: `Stopped viewing as ${existing.targetName} (${existing.targetEmail}): they cannot open the admin`,
      recordId: existing.targetId,
      recordType: "User",
    }).catch(() => undefined);
  }
  return res;
}
