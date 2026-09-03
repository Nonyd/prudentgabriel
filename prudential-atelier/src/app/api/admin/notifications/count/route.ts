import { NextResponse } from "next/server";
import { requireAdminPortalApi, resolveSessionAccess } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { adminNotificationUnreadWhere } from "@/lib/admin-notification-access";

export async function GET() {
  const gate = await requireAdminPortalApi();
  if (!gate.ok) return gate.response;
  const userId = gate.session.user.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { role, actor } = await resolveSessionAccess(gate.session);

  const count = await prisma.adminNotification.count({
    where: adminNotificationUnreadWhere(userId, role, actor),
  });
  return NextResponse.json({ count });
}
