import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ensureEmailPreference, normalizeEmail } from "@/lib/email-consent";
import { awardNewsletterPoints } from "@/lib/points";
import { rateLimitOr429 } from "@/lib/rate-limit";

const bodySchema = z.object({
  email: z.string().email(),
});

export async function POST(req: NextRequest) {
  const limited = await rateLimitOr429(req, "newsletter", 10, 60 * 60 * 1000);
  if (limited) return limited;

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const email = normalizeEmail(parsed.data.email);

  try {
    // An anonymous POST must not undo someone's unsubscribe (anyone can type
    // any address). Existing rows are left as they are; the reply is the same.
    const existing = await prisma.newsletterSubscriber.findUnique({
      where: { email },
      select: { unsubscribedAt: true },
    });
    if (existing?.unsubscribedAt) return NextResponse.json({ success: true });
    if (!existing) {
      await prisma.newsletterSubscriber.upsert({ where: { email }, create: { email }, update: {} });
    }
    await ensureEmailPreference(email);
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (user) await awardNewsletterPoints(user.id);
  } catch {
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: true });
}
