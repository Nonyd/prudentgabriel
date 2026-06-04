import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/logger";

export async function GET() {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  try {
    const orders = await prisma.order.findMany({
      where: { userId: gate.session.user.id!, isBespoke: false },
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          include: {
            product: {
              select: {
                name: true,
                slug: true,
                images: { where: { isPrimary: true }, take: 1 },
              },
            },
          },
        },
      },
    });
    return NextResponse.json({ orders });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "ACCOUNT_RTW_ORDERS",
      message: e instanceof Error ? e.message : "Failed to list RTW orders",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
