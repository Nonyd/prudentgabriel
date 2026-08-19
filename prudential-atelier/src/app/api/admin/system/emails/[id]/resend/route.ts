import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireGeneralAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { queueEmail } from "@/lib/email-outbox";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireGeneralAdminApi();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const orig = await prisma.emailMessage.findUnique({ where: { id } });
  if (!orig) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const queued = await queueEmail({
    to: orig.to,
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
  });

  return NextResponse.json({ id: queued.id, created: queued.created });
}
