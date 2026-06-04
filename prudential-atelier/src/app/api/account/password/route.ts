import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { requireSession } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { logActivity, logError } from "@/lib/logger";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
  confirmPassword: z.string().min(8),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export async function PATCH(req: NextRequest) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: gate.session.user.id! },
      select: { password: true },
    });
    if (!user?.password) {
      return NextResponse.json({ error: "Password not set for this account" }, { status: 400 });
    }

    const valid = await bcrypt.compare(parsed.data.currentPassword, user.password);
    if (!valid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }

    const hashed = await bcrypt.hash(parsed.data.newPassword, 12);
    await prisma.user.update({
      where: { id: gate.session.user.id! },
      data: { password: hashed },
    });

    await logActivity({
      userId: gate.session.user.id,
      userEmail: gate.session.user.email ?? undefined,
      action: "UPDATE",
      module: "account",
      description: "Password changed",
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "ACCOUNT_PASSWORD",
      message: e instanceof Error ? e.message : "Password change failed",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
