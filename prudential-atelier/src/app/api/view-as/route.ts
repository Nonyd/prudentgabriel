import { NextResponse } from "next/server";
import { auth, updateSession } from "@/lib/auth";
import { logActivity } from "@/lib/logger";

/**
 * DELETE /api/view-as — the banner's "Exit": back to the admin, and to her client file.
 * Ending is always allowed; it only ever restores the admin who started it.
 */
export async function DELETE() {
  const session = await auth();
  const viewAs = session?.user?.viewAs;
  if (!session?.user?.id || !viewAs) {
    return NextResponse.json({ ok: true, redirect: "/admin" });
  }

  await updateSession({ viewAsEnd: true } as never);

  const minutes = Math.max(1, Math.round((Date.now() - viewAs.startedAt) / 60_000));
  await logActivity({
    userId: viewAs.actorId,
    userEmail: viewAs.actorEmail,
    impersonatedUserId: session.user.id,
    impersonatedEmail: session.user.email ?? undefined,
    action: "CLIENT_VIEW_AS_END",
    module: "view-as",
    description: `Stopped viewing as ${viewAs.clientName} (${minutes} min)`,
    recordId: viewAs.clientProfileId,
    recordType: "ClientProfile",
  });

  return NextResponse.json({ ok: true, redirect: `/admin/clients/${viewAs.clientProfileId}` });
}
