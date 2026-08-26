import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireGeneralAdminApi } from "@/lib/admin-auth";
import { logActivity } from "@/lib/logger";
import {
  buildCampaignHtml,
  createEmailSendJob,
  queueCampaignEmails,
  sendSingleMarketingEmail,
} from "@/lib/send-email-jobs";
import {
  resolveCampaignRecipients,
  type SendEmailSource,
} from "@/lib/send-email-recipients";

const SOURCES = [
  "newsletter",
  "customers",
  "rtw_purchasers",
  "collection_buyers",
  "gold_platinum",
  "active_orders",
  "upcoming_consultations",
  "specific",
  "custom",
  "all",
] as const;

const bodySchema = z.object({
  sources: z.array(z.enum(SOURCES)).min(1),
  specificUserId: z.string().optional(),
  customEmail: z.string().email().optional(),
  collectionId: z.string().optional(),
  subject: z.string().min(1),
  body: z.string().default(""),
  templateKey: z.string().optional(),
  confirmCount: z.number().int().min(1),
});

export async function POST(req: NextRequest) {
  const gate = await requireGeneralAdminApi();
  if (!gate.ok) return gate.response;

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const d = parsed.data;
  const { emails } = await resolveCampaignRecipients({
    sources: d.sources as SendEmailSource[],
    specificUserId: d.specificUserId,
    customEmail: d.customEmail,
    collectionId: d.collectionId,
  });

  if (emails.length === 0) {
    return NextResponse.json({ error: "No recipients found" }, { status: 400 });
  }
  if (emails.length !== d.confirmCount) {
    return NextResponse.json(
      { error: `Recipient count changed (${emails.length}). Refresh and confirm again.` },
      { status: 409 },
    );
  }

  if (emails.length === 1) {
    const built = await buildCampaignHtml({
      subject: d.subject,
      body: d.body,
      templateKey: d.templateKey,
      collectionId: d.collectionId,
    });
    await sendSingleMarketingEmail({
      to: emails[0]!,
      subject: built.subject,
      html: built.html,
      template: built.template === "collection-campaign" ? "collection-campaign" : "admin-single",
      defer: true,
    });
    await logActivity({
      userId: gate.session.user!.id!,
      userEmail: gate.session.user!.email ?? undefined,
      userRole: gate.session.user!.role,
      action: "EMAIL_SENT",
      module: "email",
      description: `Queued marketing email "${d.subject}" to ${emails[0]}`,
      recordType: "Email",
    });
    return NextResponse.json({ success: true, recipientCount: 1, queued: true });
  }

  const job = await createEmailSendJob({
    recipientType: d.sources.join(","),
    recipients: emails,
    subject: d.subject,
    body: d.body,
    templateKey: d.templateKey,
    collectionId: d.collectionId,
    createdBy: gate.session.user!.id!,
  });

  await queueCampaignEmails(job.id);

  await logActivity({
    userId: gate.session.user!.id!,
    userEmail: gate.session.user!.email ?? undefined,
    userRole: gate.session.user!.role,
    action: "EMAIL_SENT",
    module: "email",
    description: `Queued campaign "${d.subject}" for ${emails.length} recipients`,
    recordId: job.id,
    recordType: "EmailSendJob",
  });

  return NextResponse.json({ jobId: job.id, recipientCount: emails.length, queued: true });
}
