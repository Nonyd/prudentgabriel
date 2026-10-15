import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendVerifyEmail } from "@/lib/email-verification";
import { logServerError } from "@/lib/logger";

const PER_HOUR = 3;

/** A new link for the signed-in account; earlier links stop working. */
export async function POST() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId || session.user.viewAs) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true, emailVerified: true },
  });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.emailVerified) return NextResponse.json({ ok: true, alreadyVerified: true });

  const limit = await checkRateLimit(`verify-email-resend:${userId}`, PER_HOUR, 60 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "We have sent a few links already. Please check your inbox, or try again in an hour." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  try {
    await sendVerifyEmail({ userId, email: user.email, firstName: (user.name ?? "").split(/\s+/)[0] ?? "" });
  } catch (error) {
    await logServerError({ errorType: "VERIFY_EMAIL_SEND", error });
    return NextResponse.json({ error: "We could not send the email just now. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
