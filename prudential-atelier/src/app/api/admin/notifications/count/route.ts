import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const count = await prisma.adminNotification.count({ where: { isRead: false } });
  return NextResponse.json({ count });
}
