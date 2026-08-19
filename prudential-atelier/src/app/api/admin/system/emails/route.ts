import { NextRequest, NextResponse } from "next/server";
import { EmailStatus } from "@prisma/client";
import { requireGeneralAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

const STATUSES = new Set<string>(Object.values(EmailStatus));

export async function GET(req: NextRequest) {
  const gate = await requireGeneralAdminApi();
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status")?.trim();
  const template = searchParams.get("template")?.trim();
  const to = searchParams.get("to")?.trim();
  const take = Math.min(Number(searchParams.get("take") ?? 50) || 50, 200);

  const where = {
    ...(status && STATUSES.has(status) ? { status: status as EmailStatus } : {}),
    ...(template ? { template: { contains: template, mode: "insensitive" as const } } : {}),
    ...(to ? { to: { contains: to, mode: "insensitive" as const } } : {}),
  };

  const [items, deadCount] = await Promise.all([
    prisma.emailMessage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        to: true,
        subject: true,
        template: true,
        status: true,
        attempts: true,
        maxAttempts: true,
        lastError: true,
        provider: true,
        sentAt: true,
        createdAt: true,
        updatedAt: true,
        nextAttemptAt: true,
        relatedType: true,
        relatedId: true,
      },
    }),
    prisma.emailMessage.count({ where: { status: EmailStatus.DEAD } }),
  ]);

  return NextResponse.json({ items, deadCount });
}
