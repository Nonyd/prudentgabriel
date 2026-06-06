import { NextResponse } from "next/server";
import { requireStaffPortal } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const gate = await requireStaffPortal();
  if (!gate.ok) return gate.response;

  const count = await prisma.staffNotification.count({
    where: { userId: gate.session.user.id!, isRead: false },
  });

  return NextResponse.json({ count });
}
