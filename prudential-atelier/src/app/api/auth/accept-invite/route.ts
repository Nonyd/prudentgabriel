import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  token: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  password: z.string().min(8),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const invitation = await tx.teamInvitation.findUnique({ where: { token: parsed.data.token } });
    if (!invitation) throw new Error("Invalid invitation token");
    if (invitation.acceptedAt) throw new Error("Invitation has already been accepted");
    if (invitation.expiresAt < now) throw new Error("Invitation has expired");

    const existing = await tx.user.findUnique({ where: { email: invitation.email } });
    if (existing) throw new Error("Email already taken");

    const hashed = await bcrypt.hash(parsed.data.password, 12);
    const user = await tx.user.create({
      data: {
        name: `${parsed.data.firstName} ${parsed.data.lastName}`.trim(),
        email: invitation.email,
        password: hashed,
        role: invitation.role,
        emailVerified: new Date(),
        referralCode: nanoid(8),
      },
      select: { id: true },
    });

    await tx.teamInvitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });

    return user;
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unable to accept invite";
    return { error: message };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true, userId: result.id });
}
