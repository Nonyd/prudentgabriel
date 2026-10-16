import { NextResponse } from "next/server";
import { requireAdminPortalApi, resolveSessionAccess } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { adminNotificationUnreadWhere } from "@/lib/admin-notification-access";

export async function GET() {
  const gate = await requireAdminPortalApi();
  if (!gate.ok) return gate.response;
  if (!gate.session.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // While viewing as someone, their alerts (named ones included) and their unread state.
  const { role, actor, user } = await resolveSessionAccess(gate.session);
  const userId = user.id;

  const count = await prisma.adminNotification.count({
    where: adminNotificationUnreadWhere(userId, role, actor),
  });
  return NextResponse.json({ count });
}
