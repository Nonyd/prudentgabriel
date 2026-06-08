import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireGeneralAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { renderCustomEmailHtml } from "@/lib/admin-email-render";
import { logActivity } from "@/lib/logger";

const bodySchema = z.object({
  replyBody: z.string().min(1),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireGeneralAdminApi();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Reply body required" }, { status: 400 });
  }

  const message = await prisma.contactMessage.findUnique({ where: { id } });
  if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const subject = `Re: ${message.subject}`;
  const html = await renderCustomEmailHtml(
    subject,
    `<p>Dear ${message.name.replace(/</g, "&lt;")},</p>${parsed.data.replyBody}`,
  );

  await sendEmail({ to: message.email, subject, html });

  const updated = await prisma.contactMessage.update({
    where: { id },
    data: {
      isReplied: true,
      isRead: true,
      repliedAt: new Date(),
      repliedBy: gate.session.user!.id!,
    },
  });

  await logActivity({
    userId: gate.session.user!.id!,
    userEmail: gate.session.user!.email ?? undefined,
    userRole: gate.session.user!.role,
    action: "EMAIL_SENT",
    module: "messages",
    description: `Replied to contact message from ${message.name}`,
    recordId: id,
    recordType: "ContactMessage",
  });

  return NextResponse.json({ item: updated });
}
