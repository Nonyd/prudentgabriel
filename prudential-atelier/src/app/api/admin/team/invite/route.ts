import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { Role } from "@prisma/client";
import { z } from "zod";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { getPublicAppUrl } from "@/lib/app-url";
import { sendEmail } from "@/lib/email";

const bodySchema = z.object({
  email: z.string().email(),
  role: z.enum(["ADMIN", "SUPER_ADMIN"]).default("ADMIN"),
  message: z.string().max(300).optional(),
});

export async function POST(req: NextRequest) {
  const gate = await requireSuperAdminApi();
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const email = parsed.data.email.toLowerCase();
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) return NextResponse.json({ error: "User already exists" }, { status: 409 });

  const token = nanoid(32);
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
  const invitation = await prisma.teamInvitation.upsert({
    where: { email },
    update: {
      role: parsed.data.role as Role,
      token,
      invitedBy: gate.session.user.id!,
      expiresAt,
      acceptedAt: null,
    },
    create: {
      email,
      role: parsed.data.role as Role,
      token,
      invitedBy: gate.session.user.id!,
      expiresAt,
    },
  });

  const acceptUrl = `${getPublicAppUrl()}/accept-invite?token=${invitation.token}`;
  const html = `
    <p>Hi, you've been invited to join the Prudent Gabriel admin team as <strong>${invitation.role}</strong>.</p>
    ${parsed.data.message ? `<p>${parsed.data.message}</p>` : ""}
    <p><a href="${acceptUrl}">Accept Invitation</a></p>
    <p>This link expires in 72 hours.</p>
  `;
  await sendEmail({
    to: invitation.email,
    subject: "You've been invited to join Prudent Gabriel Admin",
    html,
  });

  return NextResponse.json({ success: true });
}
