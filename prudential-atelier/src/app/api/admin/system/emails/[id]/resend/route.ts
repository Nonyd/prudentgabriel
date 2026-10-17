import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireGeneralAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { queueEmail } from "@/lib/email-outbox";

/** Optional corrected recipient(s), comma-separated, for a mistyped address. */
const bodySchema = z.object({
  to: z
    .string()
    .trim()
    .min(3)
    .max(500)
    .refine(
      (v) => v.split(",").every((a) => z.string().email().safeParse(a.trim()).success),
      "Enter a valid email address",
    )
    .optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireGeneralAdminApi();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
  }

  const orig = await prisma.emailMessage.findUnique({ where: { id } });
  if (!orig) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const to = parsed.data.to
    ? parsed.data.to
        .split(",")
        .map((a) => a.trim())
        .join(", ")
    : orig.to;

  const queued = await queueEmail({
    to,
    cc: orig.cc ?? undefined,
    bcc: orig.bcc ?? undefined,
    fromAddress: orig.fromAddress,
    subject: orig.subject,
    html: orig.html,
    text: orig.text ?? undefined,
    template: orig.template,
    idempotencyKey: `resend:${orig.id}:${randomUUID()}`,
    relatedType: orig.relatedType ?? undefined,
    relatedId: orig.relatedId ?? undefined,
    attachments: orig.attachments ?? undefined,
  });

  if (!queued.id) {
    return NextResponse.json(
      { error: "Not queued: that address cannot receive mail or has unsubscribed from marketing" },
      { status: 422 },
    );
  }

  return NextResponse.json({ id: queued.id, created: queued.created, to });
}
