import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  const count = await prisma.customerNotification.count({
    where: { userId: gate.session.user.id!, isRead: false },
  });

  return NextResponse.json({ count });
}
