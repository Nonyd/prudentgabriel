import { NextRequest, NextResponse } from "next/server";
import { ErrorSeverity, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { LOG_ROLES, requireRoles } from "@/lib/api-auth";
import { logError } from "@/lib/logger";

const SEVERITIES = new Set<string>(Object.values(ErrorSeverity));

export async function GET(req: NextRequest) {
  const gate = await requireRoles(LOG_ROLES);
  if (!gate.ok) return gate.response;

  try {
    const { searchParams } = new URL(req.url);
    const severity = searchParams.get("severity")?.trim();
    const resolved = searchParams.get("resolved");
    const search = searchParams.get("search")?.trim();
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get("limit") ?? "50", 10) || 50));

    const where: Prisma.ErrorLogWhereInput = {};
    if (severity && severity !== "all" && SEVERITIES.has(severity)) {
      where.severity = severity as ErrorSeverity;
    }
    if (resolved === "true") where.resolved = true;
    if (resolved === "false") where.resolved = false;
    if (search) {
      where.OR = [
        { message: { contains: search, mode: "insensitive" } },
        { errorType: { contains: search, mode: "insensitive" } },
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
      prisma.errorLog.count({ where }),
      prisma.errorLog.findMany({
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
      errorType: "ERROR_LOG_LIST",
      message: e instanceof Error ? e.message : "Failed to list error logs",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
