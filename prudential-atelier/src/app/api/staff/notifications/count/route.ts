import { NextResponse } from "next/server";
import { requireStaffPortal } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { resolveStaffPortalUser } from "@/lib/staff-view-as";

export async function GET() {
  const gate = await requireStaffPortal();
  if (!gate.ok) return gate.response;
  // Theirs, or the staff member the Super Admin is viewing as.
  const viewer = (await resolveStaffPortalUser(gate.session))!;

  const count = await prisma.staffNotification.count({
    where: { userId: viewer.id, isRead: false },
  });

  return NextResponse.json({ count });
}
