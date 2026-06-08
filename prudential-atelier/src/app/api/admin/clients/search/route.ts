import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireGeneralAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const gate = await requireGeneralAdminApi();
  if (!gate.ok) return gate.response;

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ items: [] });
  }

  const items = await prisma.user.findMany({
    where: {
      role: Role.CUSTOMER,
      OR: [
        { email: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, email: true, name: true },
    take: 12,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    items: items.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name?.trim() || u.email,
    })),
  });
}
