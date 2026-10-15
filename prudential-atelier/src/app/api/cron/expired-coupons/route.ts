import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCronRequest } from "@/lib/cron/verify";

export async function GET(request: NextRequest) {
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const res = await prisma.coupon.updateMany({
    where: {
      isActive: true,
      expiresAt: { lt: now },
    },
    data: { isActive: false },
  });

  return NextResponse.json({ ok: true, deactivated: res.count, ran: now.toISOString() });
}
