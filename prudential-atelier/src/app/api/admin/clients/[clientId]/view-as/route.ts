import { NextResponse } from "next/server";
import { auth, updateSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveSessionAccess } from "@/lib/admin-auth";
import { hasPermission } from "@/lib/roles";
import { canViewAsClient, resolveClientFileAccess } from "@/lib/client-file";
import { signViewAsTicket } from "@/lib/client-view-as";
import { logActivity } from "@/lib/logger";

type Params = { params: Promise<{ clientId: string }> };

/**
 * POST /api/admin/clients/:clientId/view-as — "View as client".
 *
 * The admin's session becomes the client's (lib/client-view-as.ts) until they
 * exit or the hour runs out. Open to an Admin or Super Admin who sees every
 * section of her file (canViewAsClient), as themselves: not under a role preview
 * or another user's "view as". Logged here, and every page and change after it
 * is logged too.
 */
export async function POST(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.viewAs) {
    return NextResponse.json({ error: "Exit the current client first." }, { status: 409 });
  }

  const { role, actor, previewRole, impersonation } = await resolveSessionAccess(session);
  if (previewRole || impersonation) {
    return NextResponse.json(
      { error: "Stop previewing a role or viewing as a team member before viewing as a client." },
      { status: 409 },
    );
  }

  const { clientId } = await params;
  const profile = await prisma.clientProfile.findUnique({
    where: { id: clientId },
    select: { id: true, user: { select: { id: true, name: true, email: true, role: true, isActive: true } } },
  });
  if (!profile) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const access = await resolveClientFileAccess(
    { userId: session.user.id, role, email: actor.email ?? null, allows: (p) => hasPermission(role, p, actor) },
    profile.id,
  );
  if (!canViewAsClient(access, role)) {
    return NextResponse.json(
      { error: "Viewing as a client is open only to an Admin or Super Admin who sees every part of her client file." },
      { status: 403 },
    );
  }
  const client = profile.user;
  if (client.role !== "CUSTOMER") {
    return NextResponse.json({ error: "This account belongs to the team, not a client." }, { status: 400 });
  }
  if (!client.isActive) {
    return NextResponse.json({ error: "Her account is deactivated." }, { status: 400 });
  }

  const ticket = signViewAsTicket({ actorId: session.user.id, targetUserId: client.id, clientProfileId: profile.id });
  const updated = await updateSession({ viewAs: ticket } as never);
  if (updated?.user?.viewAs?.clientProfileId !== profile.id) {
    return NextResponse.json({ error: "Could not start viewing as this client." }, { status: 500 });
  }

  const name = client.name?.trim() || client.email;
  await logActivity({
    userId: session.user.id,
    userEmail: session.user.email ?? undefined,
    userRole: session.user.role ?? undefined,
    impersonatedUserId: client.id,
    impersonatedEmail: client.email,
    action: "CLIENT_VIEW_AS_START",
    module: "view-as",
    description: `Started viewing as ${name}`,
    recordId: profile.id,
    recordType: "ClientProfile",
  });

  return NextResponse.json({ ok: true, redirect: "/account", expiresAt: updated.user.viewAs.exp });
}
