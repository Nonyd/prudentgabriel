import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { logActivity, logError } from "@/lib/logger";

const deleteSchema = z.object({ confirm: z.literal("DELETE") });

export async function DELETE(req: NextRequest) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Type DELETE to confirm" }, { status: 400 });
  }

  const userId = gate.session.user.id!;

  try {
    await prisma.session.deleteMany({ where: { userId } });
    await prisma.account.deleteMany({ where: { userId } });

    await prisma.user.update({
      where: { id: userId },
      data: {
        name: "Deleted User",
        email: `deleted_${userId}@prudentgabriel.local`,
        password: null,
        phone: null,
        image: null,
      },
    });

    await logActivity({
      userId,
      userEmail: gate.session.user.email ?? undefined,
      action: "DELETE",
      module: "account",
      description: "Account soft-deleted by user",
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "ACCOUNT_DELETE",
      message: e instanceof Error ? e.message : "Account delete failed",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
