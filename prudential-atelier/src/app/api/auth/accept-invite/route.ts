import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimitOr429 } from "@/lib/rate-limit";
import { INTERACTIVE_TX } from "@/lib/prisma-tx";

import { passwordPolicySchema } from "@/lib/password-policy";
import { assertCapabilityNotExpired, capabilityLookupKey } from "@/lib/capability-token";

const GONE = "This invitation has expired or is no longer valid.";
const TAKEN = "An account already exists for this email.";

const bodySchema = z.object({
  token: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  password: passwordPolicySchema,
});

export async function POST(req: NextRequest) {
  const limited = await rateLimitOr429(req, "accept-invite", 20, 15 * 60 * 1000);
  if (limited) return limited;
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const now = new Date();
  // Hash outside the interactive transaction — bcrypt must not hold a DB connection.
  const hashed = await bcrypt.hash(parsed.data.password, 12);

  const result = await prisma
    .$transaction(async (tx) => {
      const invitation = await tx.teamInvitation.findUnique({ where: { token: capabilityLookupKey(parsed.data.token) } });
      // Unknown, accepted and expired answer alike.
      if (!invitation || invitation.acceptedAt || assertCapabilityNotExpired(invitation.expiresAt, now) === "expired") {
        throw new Error(GONE);
      }

      const existing = await tx.user.findUnique({ where: { email: invitation.email } });
      if (existing) throw new Error(TAKEN);

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
    }, INTERACTIVE_TX)
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "";
      return { error: message };
    });

  if ("error" in result) {
    if (result.error === GONE) return NextResponse.json({ error: GONE }, { status: 404 });
    if (result.error === TAKEN) return NextResponse.json({ error: TAKEN }, { status: 409 });
    return NextResponse.json({ error: "Could not accept the invitation. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ success: true, userId: result.id });
}
