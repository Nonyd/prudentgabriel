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
  sanitizeFromAddress,
} from "@/lib/email-providers";
import { nextBackoffMs, type EmailError } from "@/lib/email-outbox-types";
import {
  EMAIL_PRIORITY_MARKETING,
  EMAIL_PRIORITY_TRANSACTIONAL,
  MARKETING_DRAIN_LIMIT,
  TRANSACTIONAL_MIN_PRIORITY,
  isMarketingTemplate,
} from "@/lib/email-priority";
import { lastErrorLooksLikeBounce, recordEmailBounce, applyMarketingUnsubscribe, ensureEmailPreference, normalizeEmail, suppressedEmailSet } from "@/lib/email-consent";

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
  priority?: number;
  headers?: Record<string, string>;
  /** Skip fire-and-forget deliver; cron drain sends. Campaigns must set this. */
  defer?: boolean;
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
  let html = params.html;
  let headers = params.headers;

  if (isMarketingTemplate(params.template)) {
    const suppressed = await suppressedEmailSet([params.to]);
    if (suppressed.has(normalizeEmail(params.to))) {
      return { id: "", created: false };
    }
    const pref = await ensureEmailPreference(params.to);
    const applied = await applyMarketingUnsubscribe(html, pref.unsubscribeToken);
    html = applied.html;
    if (!html.includes(applied.url)) {
      html += `<p style="font-size:11px;text-align:center;"><a href="${applied.url}">Unsubscribe</a></p>`;
    }
    headers = { ...applied.headers, ...(params.headers ?? {}) };
  }

  if (isEmailCaptureEnabled()) {
    recordCapturedEmail({ to: params.to, subject: params.subject, html });
  }

  const fromAddress = await sanitizeFromAddress(
    params.fromAddress?.trim() || (await resolveFromAddress().catch(() => EMAIL_FROM)),
  );
  const nextAttemptAt = new Date();

  try {
    const existing = await prisma.emailMessage.findUnique({
      where: { idempotencyKey: params.idempotencyKey },
      select: { id: true },
    });
    if (existing) return { id: existing.id, created: false };

    const priority =
      params.priority ??
      (isMarketingTemplate(params.template) ? EMAIL_PRIORITY_MARKETING : EMAIL_PRIORITY_TRANSACTIONAL);

    const row = await prisma.emailMessage.create({
      data: {
        idempotencyKey: params.idempotencyKey,
        to: params.to,
        cc: params.cc ?? null,
        bcc: params.bcc ?? null,
        fromAddress,
        subject: params.subject,
        template: params.template,
        html,
        text: params.text ?? null,
        attachments: params.attachments,
        status: EmailStatus.QUEUED,
        nextAttemptAt,
        relatedType: params.relatedType ?? null,
        relatedId: params.relatedId ?? null,
        priority,
        headers: headers ?? Prisma.JsonNull,
      },
      select: { id: true },
    });

    const defer = params.defer === true || skipImmediateDeliver;
    if (!isEmailCaptureEnabled() && !defer) {
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
    select: { to: true, template: true, subject: true, lastError: true },
  });
  if (lastErrorLooksLikeBounce(lastError)) {
    await recordEmailBounce(row.to, lastError).catch((e) =>
      console.warn("[email-outbox] bounce record", e),
    );
  }
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
  const from = await sanitizeFromAddress(row.fromAddress);
  if (from !== row.fromAddress) {
    await prisma.emailMessage.update({
      where: { id },
      data: { fromAddress: from },
    });
  }
  const headers =
    row.headers && typeof row.headers === "object" && !Array.isArray(row.headers)
      ? Object.fromEntries(
          Object.entries(row.headers as Record<string, unknown>).filter(
            (e): e is [string, string] => typeof e[1] === "string",
          ),
        )
      : undefined;

  const outbound = {
    to: row.to,
    cc: row.cc ?? undefined,
    bcc: row.bcc ?? undefined,
    from,
    replyTo,
    subject: row.subject,
    html: row.html,
    text: row.text ?? undefined,
    attachments: normalizeAttachments(row.attachments),
    headers,
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

function dueWhere(now: Date, stale: Date): Prisma.EmailMessageWhereInput {
  return {
    OR: [
      { status: { in: [EmailStatus.QUEUED, EmailStatus.FAILED] }, nextAttemptAt: { lte: now } },
      { status: EmailStatus.QUEUED, nextAttemptAt: null },
      { status: EmailStatus.SENDING, updatedAt: { lte: stale } },
    ],
  };
}

export async function drainQueuedEmails(opts: {
  now: Date;
  batchLimit: number;
  isBudgetExhausted: () => boolean;
}): Promise<{ processed: number; failed: number; hasMore: boolean }> {
  const stale = new Date(opts.now.getTime() - STALE_SENDING_MS);
  const due = dueWhere(opts.now, stale);

  const transactional = await prisma.emailMessage.findMany({
    where: { AND: [due, { priority: { gte: TRANSACTIONAL_MIN_PRIORITY } }] },
    orderBy: { createdAt: "asc" },
    take: opts.batchLimit,
    select: { id: true },
  });

  const remainingSlots = Math.max(0, opts.batchLimit - transactional.length);
  const marketingTake = Math.min(remainingSlots, MARKETING_DRAIN_LIMIT);
  const marketing =
    marketingTake > 0
      ? await prisma.emailMessage.findMany({
          where: { AND: [due, { priority: { lt: TRANSACTIONAL_MIN_PRIORITY } }] },
          orderBy: { createdAt: "asc" },
          take: marketingTake,
          select: { id: true },
        })
      : [];

  const rows = [...transactional, ...marketing];

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
