import { NextResponse } from "next/server";
import { requireStaffPortal } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { resolveStaffPortalUser } from "@/lib/staff-view-as";

export async function GET() {
  const gate = await requireStaffPortal();
  if (!gate.ok) return gate.response;
  // Theirs, or the staff member the Super Admin is viewing as.
  const viewer = (await resolveStaffPortalUser(gate.session))!;

  const userId = viewer.id;

  const notifications = await prisma.staffNotification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const unreadCount = await prisma.staffNotification.count({
    where: { userId, isRead: false },
  });

  return NextResponse.json({ notifications, unreadCount });
}
