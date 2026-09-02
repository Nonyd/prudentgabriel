import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const gate = await requireSuperAdminApi();
  if (!gate.ok) return gate.response;

  const { searchParams } = req.nextUrl;
  const recordId = searchParams.get("recordId") ?? undefined;
  const recordType = searchParams.get("recordType") ?? undefined;

  const items = await prisma.activityLog.findMany({
    where: {
      module: "permissions",
      ...(recordId ? { recordId } : {}),
      ...(recordType ? { recordType } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      id: true,
      userEmail: true,
      description: true,
      recordId: true,
      recordType: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    items: items.map((i) => ({
      ...i,
      createdAt: i.createdAt.toISOString(),
    })),
  });
}
