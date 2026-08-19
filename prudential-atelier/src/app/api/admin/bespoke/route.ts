import { NextRequest, NextResponse } from "next/server";
import { BespokeStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const gate = await requireAdminApi("bespoke");
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const search = searchParams.get("search")?.trim();
  const where: Prisma.BespokeRequestWhereInput = {};
  if (status && status !== "all" && (Object.values(BespokeStatus) as string[]).includes(status)) {
    where.status = status as BespokeStatus;
  }
  if (search) {
    where.OR = [
      { requestNumber: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.bespokeRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ items: rows });
}
