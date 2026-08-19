import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { requireAdminPortalApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { passwordPolicySchema } from "@/lib/password-policy";
import { applyPasswordHash } from "@/lib/password-reset";

const schema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: passwordPolicySchema,
    confirmPassword: z.string().min(1),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords must match",
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

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: gate.session.user.id! } });
  if (!user?.password) {
    return NextResponse.json({ error: "Password login not enabled for this account" }, { status: 400 });
  }

  const ok = await bcrypt.compare(parsed.data.currentPassword, user.password);
  if (!ok) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  const hash = await bcrypt.hash(parsed.data.newPassword, 12);
  await applyPasswordHash(user.id, hash);

  return NextResponse.json({ success: true });
}
