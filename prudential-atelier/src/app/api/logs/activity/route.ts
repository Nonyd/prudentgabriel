import { NextRequest, NextResponse } from "next/server";
import { ActivityAction, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { LOG_ROLES, requireRoles } from "@/lib/api-auth";
import { logError } from "@/lib/logger";

const ACTIONS = new Set<string>(Object.values(ActivityAction));

export async function GET(req: NextRequest) {
  const gate = await requireRoles(LOG_ROLES);
  if (!gate.ok) return gate.response;

  try {
    const { searchParams } = new URL(req.url);
    const moduleFilter = searchParams.get("module")?.trim();
    const action = searchParams.get("action")?.trim();
    const search = searchParams.get("search")?.trim();
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get("limit") ?? "50", 10) || 50));

    const recordType = searchParams.get("recordType")?.trim();
    const where: Prisma.ActivityLogWhereInput = {};
    if (moduleFilter && moduleFilter !== "all") where.module = moduleFilter;
    if (action && action !== "all" && ACTIONS.has(action)) {
      where.action = action as ActivityAction;
    }
    if (recordType) where.recordType = recordType;
    if (search) {
      where.OR = [
        { description: { contains: search, mode: "insensitive" } },
        { userEmail: { contains: search, mode: "insensitive" } },
        { impersonatedEmail: { contains: search, mode: "insensitive" } },
      ];
    }
    if (from || to) {
      where.createdAt = {};
      if (from) {
        const d = new Date(from);
        if (!Number.isNaN(d.getTime())) where.createdAt.gte = d;
      }
      if (to) {
        const d = new Date(to);
        if (!Number.isNaN(d.getTime())) where.createdAt.lte = d;
      }
    }

    const [total, items] = await Promise.all([
      prisma.activityLog.count({ where }),
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return NextResponse.json({ items, total, page, limit });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "ACTIVITY_LOG_LIST",
      message: e instanceof Error ? e.message : "Failed to list activity logs",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
