import { EmailSendJobStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { renderCustomEmailHtml } from "@/lib/admin-email-render";

const BATCH_SIZE = 50;

export async function createEmailSendJob(params: {
  recipientType: string;
  recipients: string[];
  subject: string;
  body: string;
  templateKey?: string;
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
      createdBy: params.createdBy,
      status: EmailSendJobStatus.PENDING,
      sent: 0,
      failed: 0,
      nextIndex: 0,
    },
  });
}

export async function getEmailSendJobStatus(jobId: string) {
  const job = await prisma.emailSendJob.findUnique({ where: { id: jobId } });
  if (!job) return null;

  return {
    total: job.total,
    sent: job.sent,
    failed: job.failed,
    status:
      job.status === EmailSendJobStatus.PENDING
        ? "pending"
        : job.status === EmailSendJobStatus.SENDING
          ? "sending"
          : job.status === EmailSendJobStatus.DONE
            ? "done"
            : "failed",
    error: job.error,
  };
}

export async function processEmailSendJobBatch(jobId: string): Promise<void> {
  const job = await prisma.emailSendJob.findUnique({ where: { id: jobId } });
  if (!job) return;
  if (job.status === EmailSendJobStatus.DONE || job.status === EmailSendJobStatus.FAILED) return;

  const recipients = job.recipients as string[];
  if (!Array.isArray(recipients) || recipients.length === 0) {
    await prisma.emailSendJob.update({
      where: { id: jobId },
      data: { status: EmailSendJobStatus.DONE },
    });
    return;
  }

  await prisma.emailSendJob.update({
    where: { id: jobId },
    data: { status: EmailSendJobStatus.SENDING },
  });

  const html = await renderCustomEmailHtml(job.subject, job.body);
  let sent = job.sent;
  let failed = job.failed;
  let nextIndex = job.nextIndex;
  const end = Math.min(nextIndex + BATCH_SIZE, recipients.length);

  for (let i = nextIndex; i < end; i += 1) {
    const to = recipients[i];
    try {
      await sendEmail({
        to,
        subject: job.subject,
        html,
        template: "admin-broadcast",
        idempotencyKey: `admin-broadcast:${jobId}:${to}`,
        relatedType: "EmailSendJob",
        relatedId: jobId,
      });
      sent += 1;
    } catch {
      failed += 1;
    }
    nextIndex = i + 1;
  }

  const done = nextIndex >= recipients.length;
  await prisma.emailSendJob.update({
    where: { id: jobId },
    data: {
      sent,
      failed,
      nextIndex,
      status: done ? EmailSendJobStatus.DONE : EmailSendJobStatus.SENDING,
    },
  });
}

export async function sendSingleEmail(subject: string, bodyHtml: string, to: string) {
  const html = await renderCustomEmailHtml(subject, bodyHtml);
  await sendEmail({
    to,
    subject,
    html,
    template: "admin-single",
    idempotencyKey: `admin-single:${to}:${subject}:${Date.now()}`,
  });
}
