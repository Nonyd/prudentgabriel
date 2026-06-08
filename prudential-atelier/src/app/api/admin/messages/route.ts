import { NextRequest, NextResponse } from "next/server";
import { requireGeneralAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const gate = await requireGeneralAdminApi();
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter") ?? "all";
  const search = searchParams.get("search")?.trim() ?? "";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = 25;

  const where: {
    isRead?: boolean;
    isReplied?: boolean;
    OR?: { name?: { contains: string; mode: "insensitive" }; email?: { contains: string; mode: "insensitive" }; subject?: { contains: string; mode: "insensitive" }; message?: { contains: string; mode: "insensitive" } }[];
  } = {};

  if (filter === "unread") where.isRead = false;
  if (filter === "read") where.isRead = true;
  if (filter === "replied") where.isReplied = true;

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { subject: { contains: search, mode: "insensitive" } },
      { message: { contains: search, mode: "insensitive" } },
    ];
  }

  const [items, total, unreadCount] = await Promise.all([
    prisma.contactMessage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.contactMessage.count({ where }),
    prisma.contactMessage.count({ where: { isRead: false } }),
  ]);

  return NextResponse.json({
    items,
    total,
    page,
    pageSize,
    unreadCount,
  });
}

export async function PATCH(req: NextRequest) {
  const gate = await requireGeneralAdminApi();
  if (!gate.ok) return gate.response;

  const body = (await req.json().catch(() => null)) as { markAllRead?: boolean } | null;
  if (!body?.markAllRead) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  await prisma.contactMessage.updateMany({ where: { isRead: false }, data: { isRead: true } });
  return NextResponse.json({ success: true });
}
