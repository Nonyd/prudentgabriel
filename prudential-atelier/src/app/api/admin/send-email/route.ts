import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireGeneralAdminApi } from "@/lib/admin-auth";
import { logActivity } from "@/lib/logger";
import {
  createEmailSendJob,
  processEmailSendJobBatch,
  sendSingleEmail,
} from "@/lib/send-email-jobs";
import { resolveRecipientEmails, type SendEmailRecipientType } from "@/lib/send-email-recipients";

const bodySchema = z.object({
  recipientType: z.enum([
    "specific",
    "all",
    "gold_platinum",
    "active_orders",
    "upcoming_consultations",
    "custom",
  ]),
  specificUserId: z.string().optional(),
  customEmail: z.string().email().optional(),
  subject: z.string().min(1),
  body: z.string().min(1),
  templateKey: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const gate = await requireGeneralAdminApi();
  if (!gate.ok) return gate.response;

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { recipientType, specificUserId, customEmail, subject, body, templateKey } = parsed.data;

  const { emails } = await resolveRecipientEmails({
    recipientType: recipientType as SendEmailRecipientType,
    specificUserId,
    customEmail,
  });

  if (emails.length === 0) {
    return NextResponse.json({ error: "No recipients found" }, { status: 400 });
  }

  if (emails.length === 1) {
    await sendSingleEmail(subject, body, emails[0]!);
    await logActivity({
      userId: gate.session.user!.id!,
      userEmail: gate.session.user!.email ?? undefined,
      userRole: gate.session.user!.role,
      action: "EMAIL_SENT",
      module: "email",
      description: `Sent email "${subject}" to ${emails[0]}`,
      recordType: "Email",
    });

    return NextResponse.json({ success: true, recipientCount: 1 });
  }

  const job = await createEmailSendJob({
    recipientType,
    recipients: emails,
    subject,
    body,
    templateKey,
    createdBy: gate.session.user!.id!,
  });

  await processEmailSendJobBatch(job.id);

  await logActivity({
    userId: gate.session.user!.id!,
    userEmail: gate.session.user!.email ?? undefined,
    userRole: gate.session.user!.role,
    action: "EMAIL_SENT",
    module: "email",
    description: `Bulk email "${subject}" queued for ${emails.length} recipients`,
    recordId: job.id,
    recordType: "EmailSendJob",
  });

  return NextResponse.json({ jobId: job.id, recipientCount: emails.length });
}
