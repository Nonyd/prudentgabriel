import { NextResponse } from "next/server";
import { PointsType } from "@prisma/client";
import { requireSession } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/logger";

export async function GET() {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  const userId = gate.session.user.id!;

  try {
    const [user, referrals, referralPoints] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { referralCode: true },
      }),
      prisma.user.findMany({
        where: { referredById: userId },
        select: {
          id: true,
          name: true,
          createdAt: true,
          orders: { select: { id: true }, take: 1 },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.pointsTransaction.aggregate({
        where: { userId, type: PointsType.EARNED_REFERRAL },
        _sum: { amount: true },
      }),
    ]);

    const list = referrals.map((r) => ({
      id: r.id,
      firstName: (r.name ?? "Friend").split(/\s+/)[0],
      joinedAt: r.createdAt,
      status: r.orders.length > 0 ? "Ordered" : "Joined",
    }));

    const converted = list.filter((r) => r.status === "Ordered").length;

    return NextResponse.json({
      referralCode: user?.referralCode ?? "",
      stats: {
        totalReferred: list.length,
        converted,
        pointsEarned: referralPoints._sum.amount ?? 0,
      },
      referrals: list,
    });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "ACCOUNT_REFERRALS",
      message: e instanceof Error ? e.message : "Failed to get referrals",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
