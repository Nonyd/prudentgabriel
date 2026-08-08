import { NextRequest, NextResponse } from "next/server";
import { AlterationStatus } from "@prisma/client";
import { FINANCE_ROLES, requireRoles } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const gate = await requireRoles(FINANCE_ROLES);
  if (!gate.ok) return gate.response;

  const status = req.nextUrl.searchParams.get("status");
  const items = await prisma.alterationRequest.findMany({
    where: status ? { status: status as AlterationStatus } : undefined,
    include: {
      order: { select: { id: true, orderRef: true, clientName: true, deliveredAt: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ items });
}
