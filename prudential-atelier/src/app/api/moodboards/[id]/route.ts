import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BESPOKE_ROLES, requireRoles } from "@/lib/api-auth";
import { logActivity, logError } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const gate = await requireRoles(BESPOKE_ROLES);
  if (!gate.ok) return gate.response;

  const { id } = await params;

  try {
    const existing = await prisma.moodboard.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.moodboard.delete({ where: { id } });

    await logActivity({
      userId: gate.session.user.id,
      userEmail: gate.session.user.email ?? undefined,
      userRole: gate.session.user.role ?? undefined,
      action: "DELETE",
      module: "clients",
      description: `Deleted moodboard "${existing.title}"`,
      recordId: id,
      recordType: "Moodboard",
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "MOODBOARD_DELETE",
      message: e instanceof Error ? e.message : "Failed to delete moodboard",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
