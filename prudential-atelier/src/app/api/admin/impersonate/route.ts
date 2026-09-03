import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  ADMIN_IMPERSONATE_COOKIE,
  IMPERSONATE_TTL_MS,
  assertCanImpersonateTarget,
  impersonationCookieOptions,
  parseImpersonationCookie,
  signImpersonationPayload,
} from "@/lib/admin-impersonate";
import { ADMIN_PREVIEW_COOKIE } from "@/lib/permission-catalog";
import { previewCookieOptions } from "@/lib/admin-preview";
import { logActivity } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const postSchema = z.object({
  userId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const gate = await requireSuperAdminApi();
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (!target.isActive) {
    return NextResponse.json({ error: "Cannot view as an inactive user." }, { status: 400 });
  }

  const allowed = assertCanImpersonateTarget({
    actorId: gate.session.user.id!,
    actorRole: gate.session.user.role,
    actorEmail: gate.session.user.email,
    targetId: target.id,
    targetRole: target.role,
  });
  if (!allowed.ok) {
    return NextResponse.json({ error: allowed.error }, { status: 400 });
  }

  const payload = {
    actorId: gate.session.user.id!,
    actorEmail: gate.session.user.email ?? "",
    targetId: target.id,
    targetEmail: target.email,
    targetName: target.name?.trim() || target.email,
    targetRole: target.role,
    exp: Date.now() + IMPERSONATE_TTL_MS,
  };

  const jar = await cookies();
  jar.set(ADMIN_IMPERSONATE_COOKIE, signImpersonationPayload(payload), impersonationCookieOptions(IMPERSONATE_TTL_MS / 1000));
  jar.set(ADMIN_PREVIEW_COOKIE, "", previewCookieOptions(0));

  await logActivity({
    userId: gate.session.user.id,
    userEmail: gate.session.user.email ?? undefined,
    userRole: gate.session.user.role,
    action: "UPDATE",
    module: "impersonation",
    description: `Started viewing as ${payload.targetName} (${target.email})`,
    recordId: target.id,
    recordType: "User",
    impersonatedUserId: target.id,
    impersonatedEmail: target.email,
  });

  return NextResponse.json({
    ok: true,
    target: { id: target.id, name: payload.targetName, email: target.email, role: target.role },
    expiresAt: payload.exp,
  });
}

export async function DELETE() {
  const gate = await requireSuperAdminApi({ allowImpersonation: true });
  if (!gate.ok) return gate.response;

  const jar = await cookies();
  const existing = parseImpersonationCookie(jar.get(ADMIN_IMPERSONATE_COOKIE)?.value);
  jar.set(ADMIN_IMPERSONATE_COOKIE, "", impersonationCookieOptions(0));

  await logActivity({
    userId: gate.session.user.id,
    userEmail: gate.session.user.email ?? undefined,
    userRole: gate.session.user.role,
    action: "UPDATE",
    module: "impersonation",
    description: existing
      ? `Stopped viewing as ${existing.targetName} (${existing.targetEmail})`
      : "Stopped viewing as another user",
    recordId: existing?.targetId,
    recordType: existing ? "User" : undefined,
    impersonatedUserId: existing?.targetId,
    impersonatedEmail: existing?.targetEmail,
  });

  return NextResponse.json({ ok: true });
}
