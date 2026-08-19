import { NextResponse } from "next/server";
import { requireAdminPortalApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const gate = await requireAdminPortalApi();
  if (!gate.ok) return gate.response;

  const count = await prisma.adminNotification.count({ where: { isRead: false } });
  return NextResponse.json({ count });
}
