import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ensureEmailPreference, normalizeEmail } from "@/lib/email-consent";
import { awardNewsletterPoints } from "@/lib/points";

const bodySchema = z.object({
  email: z.string().email(),
});

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const email = normalizeEmail(parsed.data.email);

  try {
    await prisma.newsletterSubscriber.upsert({
      where: { email },
      create: { email },
      update: { unsubscribedAt: null },
    });
    await ensureEmailPreference(email);
    await prisma.emailPreference.updateMany({
      where: { email, unsubscribedAt: { not: null } },
      data: { unsubscribedAt: null },
    });
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (user) await awardNewsletterPoints(user.id);
  } catch {
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: true });
}
