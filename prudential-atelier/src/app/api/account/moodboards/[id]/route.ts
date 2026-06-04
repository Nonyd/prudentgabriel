import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { getOrCreateClientProfile } from "@/lib/account-helpers";
import { prisma } from "@/lib/prisma";
import { logActivity, logError } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  const { id } = await params;

  try {
    const profile = await getOrCreateClientProfile(gate.session.user.id!);
    const board = await prisma.moodboard.findFirst({
      where: { id, clientId: profile.id },
    });
    if (!board) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.moodboard.delete({ where: { id } });

    await logActivity({
      userId: gate.session.user.id,
      action: "DELETE",
      module: "account",
      description: `Deleted moodboard: ${board.title}`,
      recordId: id,
      recordType: "Moodboard",
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "ACCOUNT_MOODBOARDS_DELETE",
      message: e instanceof Error ? e.message : "Failed to delete moodboard",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
