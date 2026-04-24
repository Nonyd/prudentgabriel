import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(req.url);
  const approved = searchParams.get("approved");
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const take = 20;

  const where: Prisma.ReviewWhereInput = {};
  if (approved === "true") where.isApproved = true;
  else if (approved === "false") where.isApproved = false;

  const [total, reviews] = await Promise.all([
    prisma.review.count({ where }),
    prisma.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * take,
      take,
      include: {
        user: { select: { name: true } },
        product: { select: { name: true, slug: true, category: true } },
      },
    }),
  ]);

  return NextResponse.json({ reviews, total, page });
}
