import { EmailStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { EMAIL_FROM } from "@/lib/email-transport";
import { isEmailCaptureEnabled, recordCapturedEmail } from "@/lib/email-capture";
import {
  isEmailProviderCircuitOpen,
  recordEmailProviderFailure,
  recordEmailProviderSuccess,
} from "@/lib/email-circuit-breaker";
import {
  listEmailProviders,
  normalizeAttachments,
  resolveFromAddress,
  resolveReplyTo,
} from "@/lib/email-providers";
import { nextBackoffMs, type EmailError } from "@/lib/email-outbox-types";

export type QueueEmailParams = {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  html: string;
  text?: string;
  template: string;
  idempotencyKey: string;
  relatedType?: string;
  relatedId?: string;
  fromAddress?: string;
  attachments?: Prisma.InputJsonValue;
};

const STALE_SENDING_MS = 2 * 60_000;
let authAlerted = new Set<string>();
let skipImmediateDeliver = false;

export function resetEmailAuthAlertsForTest(): void {
  authAlerted = new Set();
}

export function setSkipImmediateDeliverForTest(skip: boolean): void {
  skipImmediateDeliver = skip;
}

export async function queueEmail(params: QueueEmailParams): Promise<{ id: string; created: boolean }> {
  if (isEmailCaptureEnabled()) {
    recordCapturedEmail({ to: params.to, subject: params.subject, html: params.html });
  }

  const fromAddress = params.fromAddress?.trim() || (await resolveFromAddress().catch(() => EMAIL_FROM));
  const nextAttemptAt = new Date();

  try {
    const existing = await prisma.emailMessage.findUnique({
      where: { idempotencyKey: params.idempotencyKey },
      select: { id: true },
    });
    if (existing) return { id: existing.id, created: false };

    const row = await prisma.emailMessage.create({
      data: {
        idempotencyKey: params.idempotencyKey,
        to: params.to,
        cc: params.cc ?? null,
        bcc: params.bcc ?? null,
        fromAddress,
        subject: params.subject,
        template: params.template,
        html: params.html,
        text: params.text ?? null,
        attachments: params.attachments,
        status: EmailStatus.QUEUED,
        nextAttemptAt,
        relatedType: params.relatedType ?? null,
        relatedId: params.relatedId ?? null,
      },
      select: { id: true },
    });

    if (!isEmailCaptureEnabled() && !skipImmediateDeliver) {
      void deliverEmail(row.id).catch((e) => console.warn("[email-outbox] immediate deliver", e));
    }

    return { id: row.id, created: true };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const existing = await prisma.emailMessage.findUnique({
        where: { idempotencyKey: params.idempotencyKey },
        select: { id: true },
      });
      if (existing) return { id: existing.id, created: false };
    }
    console.warn("[email-outbox] queue failed", e);
    return { id: "", created: false };
  }
}

async function claimMessage(id: string, now: Date): Promise<boolean> {
  const stale = new Date(now.getTime() - STALE_SENDING_MS);
  const claimed = await prisma.emailMessage.updateMany({
    where: {
      id,
      OR: [
        { status: { in: [EmailStatus.QUEUED, EmailStatus.FAILED] }, nextAttemptAt: { lte: now } },
        { status: EmailStatus.QUEUED, nextAttemptAt: null },
        { status: EmailStatus.SENDING, updatedAt: { lte: stale } },
      ],
    },
    data: {
      status: EmailStatus.SENDING,
      attempts: { increment: 1 },
    },
  });
  return claimed.count === 1;
}

async function markDead(id: string, lastError: string): Promise<void> {
  const row = await prisma.emailMessage.update({
    where: { id },
    data: {
      status: EmailStatus.DEAD,
      lastError,
      nextAttemptAt: null,
    },
    select: { to: true, template: true, subject: true },
  });
  await createNotification({
    type: "EMAIL_DEAD",
    title: "Email could not be delivered",
    message: `${row.template} → ${row.to}: ${lastError}`,
    link: "/admin/system/emails",
    entityId: id,
  }).catch((e) => console.warn("[email-outbox] notify dead", e));
}

async function alertAuth(provider: string, message: string): Promise<void> {
  if (authAlerted.has(provider)) return;
  authAlerted.add(provider);
  await createNotification({
    type: "EMAIL_PROVIDER_AUTH",
    title: `Email provider auth failed (${provider})`,
    message,
    link: "/admin/system/emails",
  }).catch((e) => console.warn("[email-outbox] notify auth", e));
}

async function alertProviderConfig(provider: string, message: string): Promise<void> {
  const key = `config:${provider}:${message.slice(0, 80)}`;
  if (authAlerted.has(key)) return;
  authAlerted.add(key);
  await createNotification({
    type: "EMAIL_PROVIDER_AUTH",
    title: `Email provider config error (${provider})`,
    message,
    link: "/admin/system/emails",
  }).catch((e) => console.warn("[email-outbox] notify config", e));
}

export async function deliverEmail(id: string): Promise<void> {
  if (!id) return;
  const now = new Date();
  const claimed = await claimMessage(id, now);
  if (!claimed) return;

  const row = await prisma.emailMessage.findUnique({ where: { id } });
  if (!row) return;

  const providers = await listEmailProviders();
  if (providers.length === 0) {
    await markDead(id, "no provider configured");
    return;
  }

  const available = providers.filter((p) => !isEmailProviderCircuitOpen(p.name));
  if (available.length === 0) {
    await prisma.emailMessage.update({
      where: { id },
      data: {
        status: EmailStatus.FAILED,
        lastError: "all providers unavailable (circuit open)",
        nextAttemptAt: new Date(Date.now() + nextBackoffMs(row.attempts)),
      },
    });
    return;
  }

  const replyTo = await resolveReplyTo().catch(() => undefined);
  const outbound = {
    to: row.to,
    cc: row.cc ?? undefined,
    bcc: row.bcc ?? undefined,
    from: row.fromAddress,
    replyTo,
    subject: row.subject,
    html: row.html,
    text: row.text ?? undefined,
    attachments: normalizeAttachments(row.attachments),
  };

  let lastError: EmailError | null = null;

  for (const provider of available) {
    const result = await provider.send(outbound);
    if ("id" in result) {
      recordEmailProviderSuccess(provider.name);
      await prisma.emailMessage.update({
        where: { id },
        data: {
          status: EmailStatus.SENT,
          provider: provider.name,
          providerMessageId: result.id,
          sentAt: new Date(),
          lastError: null,
          nextAttemptAt: null,
        },
      });
      return;
    }

    lastError = result.error;
    recordEmailProviderFailure(provider.name);

    if (result.error.kind === "auth") {
      await alertAuth(provider.name, result.error.message);
      continue;
    }

    if (result.error.kind === "terminal") {
      if (result.error.alert === "provider_config") {
        await alertProviderConfig(provider.name, result.error.message);
      }
      await markDead(id, result.error.message);
      return;
    }
  }

  const message = lastError?.message ?? "delivery failed";
  if (row.attempts >= row.maxAttempts || lastError == null) {
    await markDead(id, message);
    return;
  }

  await prisma.emailMessage.update({
    where: { id },
    data: {
      status: EmailStatus.FAILED,
      lastError: message,
      nextAttemptAt: new Date(Date.now() + nextBackoffMs(row.attempts)),
    },
  });
}

export async function drainQueuedEmails(opts: {
  now: Date;
  batchLimit: number;
  isBudgetExhausted: () => boolean;
}): Promise<{ processed: number; failed: number; hasMore: boolean }> {
  const stale = new Date(opts.now.getTime() - STALE_SENDING_MS);
  const rows = await prisma.emailMessage.findMany({
    where: {
      OR: [
        { status: { in: [EmailStatus.QUEUED, EmailStatus.FAILED] }, nextAttemptAt: { lte: opts.now } },
        { status: EmailStatus.QUEUED, nextAttemptAt: null },
        { status: EmailStatus.SENDING, updatedAt: { lte: stale } },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: opts.batchLimit,
    select: { id: true },
  });

  let processed = 0;
  let failed = 0;
  for (const row of rows) {
    if (opts.isBudgetExhausted()) {
      return { processed, failed, hasMore: true };
    }
    try {
      await deliverEmail(row.id);
      processed += 1;
    } catch {
      failed += 1;
    }
  }

  const remaining = await prisma.emailMessage.count({
    where: {
      OR: [
        { status: { in: [EmailStatus.QUEUED, EmailStatus.FAILED] }, nextAttemptAt: { lte: new Date() } },
        { status: EmailStatus.QUEUED, nextAttemptAt: null },
      ],
    },
  });

  return { processed, failed, hasMore: remaining > 0 };
}
