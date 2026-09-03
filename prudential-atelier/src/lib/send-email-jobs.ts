import { EmailSendJobStatus, EmailStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { renderCollectionCampaignHtml, renderCustomEmailHtml } from "@/lib/admin-email-render";
import { getEmailTemplate } from "@/lib/admin-email-template-store";
import { EMAIL_TEMPLATE_KEYS } from "@/lib/admin-email-catalog";
import { mergeCollectionProductsForCampaign } from "@/lib/collection-products";
import { derivedCatalogMinNGN } from "@/lib/pricing";
import { applyMarketingUnsubscribe, ensureEmailPreference, normalizeEmail, suppressedEmailSet } from "@/lib/email-consent";
import { EMAIL_PRIORITY_MARKETING } from "@/lib/email-priority";
import { optimizeImageUrl } from "@/lib/utils";
import { emailAllowsCollectionCampaign } from "@/lib/account-helpers";
import type { CampaignProduct } from "@/emails/CollectionCampaignEmail";

export async function createEmailSendJob(params: {
  recipientType: string;
  recipients: string[];
  subject: string;
  body: string;
  templateKey?: string;
  collectionId?: string;
  createdBy: string;
}) {
  return prisma.emailSendJob.create({
    data: {
      recipientType: params.recipientType,
      recipients: params.recipients,
      total: params.recipients.length,
      subject: params.subject,
      body: params.body,
      templateKey: params.templateKey ?? null,
      collectionId: params.collectionId ?? null,
      createdBy: params.createdBy,
      status: EmailSendJobStatus.PENDING,
      sent: 0,
      failed: 0,
      nextIndex: 0,
    },
  });
}

export async function syncEmailSendJobProgress(jobId: string) {
  const job = await prisma.emailSendJob.findUnique({ where: { id: jobId } });
  if (!job) return null;

  const [sent, dead, pending] = await Promise.all([
    prisma.emailMessage.count({
      where: { relatedType: "EmailSendJob", relatedId: jobId, status: EmailStatus.SENT },
    }),
    prisma.emailMessage.count({
      where: { relatedType: "EmailSendJob", relatedId: jobId, status: EmailStatus.DEAD },
    }),
    prisma.emailMessage.count({
      where: {
        relatedType: "EmailSendJob",
        relatedId: jobId,
        status: { in: [EmailStatus.QUEUED, EmailStatus.SENDING, EmailStatus.FAILED] },
      },
    }),
  ]);

  let status: EmailSendJobStatus = job.status;
  if (job.total === 0) status = EmailSendJobStatus.DONE;
  else if (pending === 0 && sent + dead >= job.total) status = EmailSendJobStatus.DONE;
  else if (sent + dead + pending > 0) status = EmailSendJobStatus.SENDING;

  if (status !== job.status || sent !== job.sent || dead !== job.failed) {
    await prisma.emailSendJob.update({
      where: { id: jobId },
      data: { status, sent, failed: dead },
    });
  }

  return {
    total: job.total,
    sent,
    failed: dead,
    pending,
    status:
      status === EmailSendJobStatus.PENDING
        ? "pending"
        : status === EmailSendJobStatus.SENDING
          ? "sending"
          : status === EmailSendJobStatus.DONE
            ? "done"
            : "failed",
    error: job.error,
  };
}

export async function getEmailSendJobStatus(jobId: string) {
  return syncEmailSendJobProgress(jobId);
}

export async function buildCampaignHtml(params: {
  subject: string;
  body: string;
  templateKey?: string | null;
  collectionId?: string | null;
}): Promise<{ subject: string; html: string; template: string }> {
  if (params.templateKey === EMAIL_TEMPLATE_KEYS.COLLECTION_CAMPAIGN && params.collectionId) {
    const collection = await prisma.collection.findUnique({ where: { id: params.collectionId } });
    if (!collection) throw new Error("Collection not found");
    const stored = await getEmailTemplate(EMAIL_TEMPLATE_KEYS.COLLECTION_CAMPAIGN);
    if (!stored) throw new Error("Collection template missing");
    const merged = await mergeCollectionProductsForCampaign(collection.id, collection.autoTag, 8);
    const products: CampaignProduct[] = merged.map((p) => {
      const img = p.images.find((i) => i.isPrimary) ?? p.images[0];
      return {
        name: p.name,
        slug: p.slug,
        imageUrl: img?.url ? optimizeImageUrl(img.url, 240) : null,
        priceLabel: `From ₦${Math.round(p.variants.length ? derivedCatalogMinNGN(p.variants, p.isOnSale) : p.basePriceNGN).toLocaleString("en-NG")}`,
      };
    });
    const rendered = await renderCollectionCampaignHtml({
      fields: stored,
      collectionName: collection.name,
      collectionSlug: collection.slug,
      coverImage: collection.coverImage,
      coverImageAlt: collection.coverImageAlt,
      products,
    });
    return { subject: rendered.subject, html: rendered.html, template: "collection-campaign" };
  }

  const html = await renderCustomEmailHtml(params.subject, params.body);
  return { subject: params.subject, html, template: "admin-broadcast" };
}

/** Queue every recipient into the outbox. Drain cron delivers. Does not send. */
export async function queueCampaignEmails(jobId: string): Promise<void> {
  const job = await prisma.emailSendJob.findUnique({ where: { id: jobId } });
  if (!job) return;

  const recipients = job.recipients as string[];
  if (!Array.isArray(recipients) || recipients.length === 0) {
    await prisma.emailSendJob.update({
      where: { id: jobId },
      data: { status: EmailSendJobStatus.DONE },
    });
    return;
  }

  const built = await buildCampaignHtml({
    subject: job.subject,
    body: job.body,
    templateKey: job.templateKey,
    collectionId: job.collectionId,
  });

  const suppressed = await suppressedEmailSet(recipients.map((r) => String(r)));

  for (const raw of recipients) {
    const to = normalizeEmail(raw);
    if (suppressed.has(to)) continue;
    if (built.template === "collection-campaign" && !(await emailAllowsCollectionCampaign(to))) {
      continue;
    }
    const pref = await ensureEmailPreference(to);
    const { html, headers } = await applyMarketingUnsubscribe(built.html, pref.unsubscribeToken);
    await sendEmail({
      to,
      subject: built.subject,
      html,
      template: built.template,
      idempotencyKey: `campaign:${jobId}:${to}`,
      relatedType: "EmailSendJob",
      relatedId: jobId,
      priority: EMAIL_PRIORITY_MARKETING,
      headers,
      defer: true,
    });
  }

  await prisma.emailSendJob.update({
    where: { id: jobId },
    data: { status: EmailSendJobStatus.SENDING, nextIndex: recipients.length },
  });
}

export async function sendSingleMarketingEmail(params: {
  to: string;
  subject: string;
  html: string;
  template: string;
  defer?: boolean;
}) {
  const to = normalizeEmail(params.to);
  if (params.template === "collection-campaign" && !(await emailAllowsCollectionCampaign(to))) {
    return;
  }
  const pref = await ensureEmailPreference(to);
  const { html, headers } = await applyMarketingUnsubscribe(params.html, pref.unsubscribeToken);
  await sendEmail({
    to,
    subject: params.subject,
    html,
    template: params.template,
    idempotencyKey: `admin-single:${to}:${params.subject}:${Date.now()}`,
    priority: EMAIL_PRIORITY_MARKETING,
    headers,
    defer: params.defer === true,
  });
}
