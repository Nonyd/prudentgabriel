import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { HR_ROLES, requireRoles } from "@/lib/api-auth";
import { logError } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const gate = await requireRoles(HR_ROLES);
  if (!gate.ok) return gate.response;

  try {
    const { searchParams } = new URL(req.url);
    const staffId = searchParams.get("staffId")?.trim();
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get("limit") ?? "50", 10) || 50));

    const where: Prisma.AttendanceLogWhereInput = {};
    if (staffId) where.staffId = staffId;
    if (from || to) {
      where.date = {};
      if (from) {
        const d = new Date(from);
        if (!Number.isNaN(d.getTime())) where.date.gte = d;
      }
      if (to) {
        const d = new Date(to);
        if (!Number.isNaN(d.getTime())) where.date.lte = d;
      }
    }

    const [total, items] = await Promise.all([
      prisma.attendanceLog.count({ where }),
      prisma.attendanceLog.findMany({
        where,
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          staff: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      }),
    ]);

    return NextResponse.json({ items, total, page, limit });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "ATTENDANCE_LIST",
      message: e instanceof Error ? e.message : "Failed to list attendance",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
