import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LOG_ROLES, requireRoles } from "@/lib/api-auth";
import { logActivity, logError } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const gate = await requireRoles(LOG_ROLES);
  if (!gate.ok) return gate.response;

  const { id } = await params;

  let body: { resolveNote?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  try {
    const existing = await prisma.errorLog.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const item = await prisma.errorLog.update({
      where: { id },
      data: {
        resolved: true,
        resolvedBy: gate.session.user.id,
        resolvedAt: new Date(),
        resolveNote: body.resolveNote?.trim() || null,
      },
    });

    await logActivity({
      userId: gate.session.user.id,
      userEmail: gate.session.user.email ?? undefined,
      userRole: gate.session.user.role ?? undefined,
      action: "UPDATE",
      module: "logs",
      description: `Resolved error log ${existing.errorType}`,
      recordId: id,
      recordType: "ErrorLog",
    });

    return NextResponse.json({ item });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "ERROR_LOG_RESOLVE",
      message: e instanceof Error ? e.message : "Failed to resolve error log",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
