import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") ?? "1") || 1);
  const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? "15") || 15));
  const skip = (page - 1) * limit;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { pointsBalance: true },
  });

  const [transactions, total] = await Promise.all([
    prisma.pointsTransaction.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.pointsTransaction.count({ where: { userId: session.user.id } }),
  ]);

  return NextResponse.json({
    pointsBalance: user?.pointsBalance ?? 0,
    pointsNGN: user?.pointsBalance ?? 0,
    transactions,
    page,
    total,
    totalPages: Math.ceil(total / limit),
  });
}
