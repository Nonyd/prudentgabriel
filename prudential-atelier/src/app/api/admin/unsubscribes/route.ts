import { NextRequest, NextResponse } from "next/server";
import { requireGeneralAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const gate = await requireGeneralAdminApi();
  if (!gate.ok) return gate.response;

  const take = Math.min(Number(req.nextUrl.searchParams.get("take") ?? 100) || 100, 200);

  const items = await prisma.emailPreference.findMany({
    where: { unsubscribedAt: { not: null } },
    orderBy: { unsubscribedAt: "desc" },
    take,
    select: { email: true, unsubscribedAt: true, bounceAt: true, createdAt: true },
  });

  const newsletterEmails = await prisma.newsletterSubscriber.findMany({
    where: { email: { in: items.map((i) => i.email) } },
    select: { email: true },
  });
  const onList = new Set(newsletterEmails.map((n) => n.email));

  return NextResponse.json({
    items: items.map((i) => ({
      email: i.email,
      unsubscribedAt: i.unsubscribedAt,
      bounceAt: i.bounceAt,
      wasNewsletter: onList.has(i.email),
    })),
  });
}
