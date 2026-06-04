import { NextRequest, NextResponse } from "next/server";
import { LoyaltyTier, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BESPOKE_ROLES, requireRoles } from "@/lib/api-auth";
import { logError } from "@/lib/logger";

const TIERS = new Set<string>(Object.values(LoyaltyTier));

export async function GET(req: NextRequest) {
  const gate = await requireRoles(BESPOKE_ROLES);
  if (!gate.ok) return gate.response;

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim();
    const tier = searchParams.get("tier");

    const where: Prisma.ClientProfileWhereInput = {};
    if (tier && tier !== "all" && TIERS.has(tier)) {
      where.loyaltyTier = tier as LoyaltyTier;
    }
    if (search) {
      where.user = {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    const items = await prisma.clientProfile.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, createdAt: true } },
        bespokeOrders: {
          select: { id: true, orderRef: true, currentStage: true, status: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        _count: { select: { bespokeOrders: true } },
      },
    });

    return NextResponse.json({ items });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "CLIENT_LIST",
      message: e instanceof Error ? e.message : "Failed to list clients",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
