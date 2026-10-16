import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { requireAdminPortalApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { emptyableStoredPublicMediaUrlSchema } from "@/lib/media/stored-url";
import { changeUserEmail } from "@/lib/admin-email-change";
import { getClientIp } from "@/lib/rate-limit";

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  /** BF5: what visitors see in chat. Empty means the first name. */
  displayName: z.string().trim().max(40).optional(),
  image: emptyableStoredPublicMediaUrlSchema,
  email: z.string().email().optional(),
  currentPassword: z.string().min(1).optional(),
});

export async function PATCH(req: NextRequest) {
  const gate = await requireAdminPortalApi();
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path.join(".");
    return NextResponse.json(
      { error: issue ? `${field ? `${field}: ` : ""}${issue.message}` : "Invalid request" },
      { status: 400 },
    );
  }

  const { name, displayName, image, email, currentPassword } = parsed.data;
  const nextEmail = email?.trim().toLowerCase();
  const changingEmail = Boolean(nextEmail && nextEmail !== gate.session.user.email?.toLowerCase());

  if (changingEmail) {
    if (gate.session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Only the super admin can change this email" }, { status: 403 });
    }
    if (!currentPassword) {
      return NextResponse.json({ error: "Current password is required to change email" }, { status: 400 });
    }
    const user = await prisma.user.findUnique({
      where: { id: gate.session.user.id! },
      select: { password: true },
    });
    if (!user?.password) {
      return NextResponse.json({ error: "Password login not enabled for this account" }, { status: 400 });
    }
    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }
  }

  if (changingEmail) {
    // Same rule as every other email change: free address, logged, old address told.
    const changed = await changeUserEmail({
      targetUserId: gate.session.user.id!,
      nextEmail,
      actor: { id: gate.session.user.id!, email: gate.session.user.email, role: gate.session.user.role },
      ip: getClientIp(req),
      selfConfirmed: true,
    });
    if (!changed.ok) return NextResponse.json({ error: changed.error }, { status: changed.status });
  }

  try {
    const updated = await prisma.user.update({
      where: { id: gate.session.user.id! },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(displayName !== undefined ? { displayName: displayName || null } : {}),
        ...(image !== undefined ? { image: image || null } : {}),
      },
      select: { name: true, email: true, image: true },
    });

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "That email is already in use" }, { status: 409 });
    }
    throw err;
  }
}
