import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPublicAppUrl } from "@/lib/app-url";
import { sendPasswordResetEmail } from "@/lib/email";
import { logActivity } from "@/lib/logger";
import { forceSignOutUser, issuePasswordResetToken } from "@/lib/password-reset";
import { isProtectedAccount } from "@/lib/roles";

const PROTECTED_MSG = "This account is protected and cannot be modified.";

export async function sendAdminPasswordReset(opts: {
  actorId: string;
  actorEmail: string | null | undefined;
  actorRole: string | undefined;
  targetId: string;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const target = await prisma.user.findUnique({
    where: { id: opts.targetId },
    select: { id: true, email: true, password: true },
  });
  if (!target) return { ok: false, status: 404, error: "User not found" };
  if (isProtectedAccount(target.email)) return { ok: false, status: 403, error: PROTECTED_MSG };
  if (opts.actorId === target.id) {
    return { ok: false, status: 400, error: "Use account settings to change your own password." };
  }
  if (!target.password) {
    return { ok: false, status: 400, error: "This account has no password to reset." };
  }

  const { raw, hash } = await issuePasswordResetToken(target.id);
  await forceSignOutUser(target.id);
  const resetUrl = `${getPublicAppUrl()}/auth/reset-password/${raw}`;
  await sendPasswordResetEmail(target.email, resetUrl, hash);

  await logActivity({
    userId: opts.actorId,
    userEmail: opts.actorEmail ?? undefined,
    userRole: opts.actorRole,
    action: "UPDATE",
    module: "users",
    description: `Sent password reset link to ${target.email}`,
    recordId: target.id,
    recordType: "User",
  });

  return { ok: true };
}

export async function forceAdminSignOut(opts: {
  actorId: string;
  actorEmail: string | null | undefined;
  actorRole: string | undefined;
  targetId: string;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const target = await prisma.user.findUnique({
    where: { id: opts.targetId },
    select: { id: true, email: true },
  });
  if (!target) return { ok: false, status: 404, error: "User not found" };
  if (isProtectedAccount(target.email)) return { ok: false, status: 403, error: PROTECTED_MSG };
  if (opts.actorId === target.id) {
    return { ok: false, status: 400, error: "Sign out from the top bar instead." };
  }

  await forceSignOutUser(target.id);

  await logActivity({
    userId: opts.actorId,
    userEmail: opts.actorEmail ?? undefined,
    userRole: opts.actorRole,
    action: "LOGOUT",
    module: "users",
    description: `Forced sign-out for ${target.email}`,
    recordId: target.id,
    recordType: "User",
  });

  return { ok: true };
}

export function jsonError(result: { ok: false; status: number; error: string }) {
  return NextResponse.json({ error: result.error }, { status: result.status });
}
