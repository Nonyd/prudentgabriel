import type { ActivityAction, Prisma } from "@prisma/client";
import type { CronJobContext, JobResult } from "@/lib/cron/types";
import { prisma } from "@/lib/prisma";
import { keyFromMediaUrl } from "@/lib/media";
import { destroyStoredMedia } from "@/lib/media/destroy";
import { referencedDigests } from "@/lib/cron/jobs/orphan-uploads";

/**
 * Data retention (NDPA 2023 s.24(1)(d) / GDPR art. 5(1)(e)): personal data is
 * kept no longer than its purpose needs. Each run deletes at most `batchLimit`
 * rows per category, oldest purpose first, and stops when the time budget runs out.
 *
 * Never touched here: orders, payments, invoices, users, measurements, bookings,
 * commissions, quotations and chats (chat-retention has its own period).
 */

/** Declined enquiries, and approved ones whose booking link lapsed unused: since the decision. */
export const ENQUIRY_RETENTION_MONTHS = 12;
/** Rejected applications, and unhired ones to a posting closed that long: since last update. */
export const JOB_APPLICATION_RETENTION_MONTHS = 12;
export const CONTACT_MESSAGE_RETENTION_MONTHS = 24;
export const ERROR_LOG_RETENTION_DAYS = 90;
/** Abandoned checkouts that never became an order: since last activity. */
export const CHECKOUT_SESSION_RETENTION_DAYS = 90;
/** Stored copies of sent/failed emails not tied to a financial record. */
export const EMAIL_MESSAGE_RETENTION_MONTHS = 24;
/** Routine activity (edits, stage moves, clock-ins, view-as, email sent). */
export const ACTIVITY_LOG_RETENTION_MONTHS = 24;
/** Security, permission, payment and delete activity: kept for audit. */
export const ACTIVITY_LOG_AUDIT_RETENTION_YEARS = 6;
/** Notifications already read. Unread ones stay until read. */
export const NOTIFICATION_RETENTION_MONTHS = 12;

/** Activity kept for the audit period whatever its module. */
export const AUDIT_ACTIVITY_ACTIONS: readonly ActivityAction[] = [
  "DELETE",
  "LOGIN",
  "LOGOUT",
  "PAYMENT_CONFIRM",
  "ORDER_CREATE",
  "INVOICE_SEND",
  "QUOTE_SEND",
];

/** Activity in these modules is about access, money or accounts: audit period. */
export const AUDIT_ACTIVITY_MODULES: readonly string[] = [
  "permissions",
  "impersonation",
  "security",
  "users",
  "staff",
  "job_roles",
  "team",
  "settings",
  "account",
  "payments",
  "invoices",
  "logs",
];

/** EmailMessage.relatedType values that make the email part of a financial record. */
export const FINANCIAL_EMAIL_TYPES: readonly string[] = [
  "Order",
  "Invoice",
  "Payment",
  "BespokeOrder",
  "Quotation",
];

function monthsBefore(now: Date, months: number): Date {
  const d = new Date(now.getTime());
  d.setUTCMonth(d.getUTCMonth() - months);
  return d;
}

function daysBefore(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export function retentionCutoffs(now: Date) {
  return {
    enquiry: monthsBefore(now, ENQUIRY_RETENTION_MONTHS),
    jobApplication: monthsBefore(now, JOB_APPLICATION_RETENTION_MONTHS),
    contactMessage: monthsBefore(now, CONTACT_MESSAGE_RETENTION_MONTHS),
    errorLog: daysBefore(now, ERROR_LOG_RETENTION_DAYS),
    checkoutSession: daysBefore(now, CHECKOUT_SESSION_RETENTION_DAYS),
    emailMessage: monthsBefore(now, EMAIL_MESSAGE_RETENTION_MONTHS),
    activityLog: monthsBefore(now, ACTIVITY_LOG_RETENTION_MONTHS),
    activityLogAudit: monthsBefore(now, ACTIVITY_LOG_AUDIT_RETENTION_YEARS * 12),
    notification: monthsBefore(now, NOTIFICATION_RETENTION_MONTHS),
  };
}

/** Every filter the job deletes by. Pure, so the rules can be checked without a database. */
export function retentionWhere(now: Date) {
  const c = retentionCutoffs(now);
  const decidedBefore = (cutoff: Date): Prisma.ConsultationEnquiryWhereInput => ({
    OR: [{ decidedAt: { lt: cutoff } }, { decidedAt: null, createdAt: { lt: cutoff } }],
  });

  const enquiry: Prisma.ConsultationEnquiryWhereInput = {
    bookingId: null,
    OR: [
      { status: "DECLINED", ...decidedBefore(c.enquiry) },
      {
        // Approved, never booked, and the booking link has lapsed.
        status: "APPROVED",
        AND: [decidedBefore(c.enquiry), { OR: [{ publicTokenExpiresAt: null }, { publicTokenExpiresAt: { lt: now } }] }],
      },
    ],
  };

  const jobApplication: Prisma.JobApplicationWhereInput = {
    updatedAt: { lt: c.jobApplication },
    OR: [
      { status: "REJECTED" },
      {
        // Never hired, and the posting closed (deadline passed) over the period ago.
        status: { in: ["NEW", "REVIEWED", "SHORTLISTED", "INTERVIEWED"] },
        job: { deadline: { lt: c.jobApplication } },
      },
    ],
  };

  const contactMessage: Prisma.ContactMessageWhereInput = { createdAt: { lt: c.contactMessage } };
  const errorLog: Prisma.ErrorLogWhereInput = { createdAt: { lt: c.errorLog } };
  const checkoutSession: Prisma.CheckoutSessionWhereInput = {
    orderId: null,
    recoveredAt: null,
    lastActiveAt: { lt: c.checkoutSession },
    updatedAt: { lt: c.checkoutSession },
  };
  const emailMessage: Prisma.EmailMessageWhereInput = {
    createdAt: { lt: c.emailMessage },
    status: { in: ["SENT", "FAILED", "DEAD"] },
    OR: [{ relatedType: null }, { relatedType: { notIn: [...FINANCIAL_EMAIL_TYPES] } }],
  };
  const activityLogRoutine: Prisma.ActivityLogWhereInput = {
    createdAt: { lt: c.activityLog },
    action: { notIn: [...AUDIT_ACTIVITY_ACTIONS] },
    module: { notIn: [...AUDIT_ACTIVITY_MODULES] },
  };
  const activityLogAudit: Prisma.ActivityLogWhereInput = { createdAt: { lt: c.activityLogAudit } };
  const customerNotification: Prisma.CustomerNotificationWhereInput = {
    isRead: true,
    createdAt: { lt: c.notification },
  };
  const staffNotification: Prisma.StaffNotificationWhereInput = {
    isRead: true,
    createdAt: { lt: c.notification },
  };
  const adminNotification: Prisma.AdminNotificationWhereInput = {
    createdAt: { lt: c.notification },
    OR: [{ isRead: true }, { acknowledgedAt: { not: null } }, { reads: { some: {} } }],
  };

  return {
    enquiry,
    jobApplication,
    contactMessage,
    errorLog,
    checkoutSession,
    emailMessage,
    activityLogRoutine,
    activityLogAudit,
    customerNotification,
    staffNotification,
    adminNotification,
  };
}

const DIGEST_IN_KEY = /([0-9a-f]{32})\.[a-z0-9]+$/;

/**
 * Best effort: delete files that belonged to rows already deleted. Uploads are
 * content-addressed, so the same file can belong to another live row — a local
 * file is deleted only when its digest appears nowhere in the database any more.
 * Anything missed here is picked up by orphan-uploads.
 */
export async function deleteFilesOfDeletedRows(urls: string[]): Promise<{ deleted: number; kept: number; failed: number }> {
  const unique = Array.from(new Set(urls.filter((u) => typeof u === "string" && u.trim())));
  if (unique.length === 0) return { deleted: 0, kept: 0, failed: 0 };
  const digestOf = new Map<string, string>();
  for (const url of unique) {
    const key = keyFromMediaUrl(url);
    const m = key ? DIGEST_IN_KEY.exec(key) : null;
    if (m) digestOf.set(url, m[1]);
  }
  let referenced = new Set<string>();
  try {
    referenced = await referencedDigests(Array.from(new Set(digestOf.values())));
  } catch {
    // Cannot prove a local file is unused: keep them all this run.
    referenced = new Set(digestOf.values());
  }
  let deleted = 0;
  let kept = 0;
  let failed = 0;
  for (const url of unique) {
    const digest = digestOf.get(url);
    if (digest && referenced.has(digest)) {
      kept += 1;
      continue;
    }
    try {
      await destroyStoredMedia(url);
      deleted += 1;
    } catch {
      failed += 1;
    }
  }
  return { deleted, kept, failed };
}

type StepResult = { deleted: number; full: boolean; files?: { deleted: number; kept: number; failed: number } };

export async function run(ctx: CronJobContext): Promise<JobResult> {
  const where = retentionWhere(ctx.now);
  const take = ctx.batchLimit;

  const steps: [string, () => Promise<StepResult>][] = [
    [
      "consultationEnquiries",
      async () => {
        const rows = await prisma.consultationEnquiry.findMany({
          where: where.enquiry,
          select: { id: true, moodboardImages: true },
          orderBy: { createdAt: "asc" },
          take,
        });
        const { count } = await prisma.consultationEnquiry.deleteMany({
          where: { id: { in: rows.map((r) => r.id) }, ...where.enquiry },
        });
        const files = await deleteFilesOfDeletedRows(rows.flatMap((r) => r.moodboardImages));
        return { deleted: count, full: rows.length >= take, files };
      },
    ],
    [
      "jobApplications",
      async () => {
        const rows = await prisma.jobApplication.findMany({
          where: where.jobApplication,
          select: { id: true, cvUrl: true, portfolioUrl: true, schoolItLetter: true, schoolIdCard: true },
          orderBy: { updatedAt: "asc" },
          take,
        });
        const { count } = await prisma.jobApplication.deleteMany({
          where: { id: { in: rows.map((r) => r.id) }, ...where.jobApplication },
        });
        const urls = rows.flatMap((r) =>
          [r.cvUrl, r.portfolioUrl, r.schoolItLetter, r.schoolIdCard].filter((u): u is string => Boolean(u)),
        );
        const files = await deleteFilesOfDeletedRows(urls);
        return { deleted: count, full: rows.length >= take, files };
      },
    ],
    ["contactMessages", () => deleteBatch("contactMessage", where.contactMessage, take)],
    ["errorLogs", () => deleteBatch("errorLog", where.errorLog, take)],
    ["checkoutSessions", () => deleteBatch("checkoutSession", where.checkoutSession, take)],
    ["emailMessages", () => deleteBatch("emailMessage", where.emailMessage, take)],
    ["activityLogsRoutine", () => deleteBatch("activityLog", where.activityLogRoutine, take)],
    ["activityLogsAudit", () => deleteBatch("activityLog", where.activityLogAudit, take)],
    ["customerNotifications", () => deleteBatch("customerNotification", where.customerNotification, take)],
    ["staffNotifications", () => deleteBatch("staffNotification", where.staffNotification, take)],
    ["adminNotifications", () => deleteBatch("adminNotification", where.adminNotification, take)],
  ];

  let processed = 0;
  let failed = 0;
  let hasMore = false;
  const detail: Record<string, unknown> = {};
  const failedSteps: string[] = [];
  let filesDeleted = 0;
  let filesKept = 0;
  let filesFailed = 0;

  for (const [name, step] of steps) {
    if (ctx.isBudgetExhausted()) {
      hasMore = true;
      detail.stoppedBefore = name;
      break;
    }
    try {
      const r = await step();
      processed += r.deleted;
      detail[name] = r.deleted;
      if (r.full) hasMore = true;
      if (r.files) {
        filesDeleted += r.files.deleted;
        filesKept += r.files.kept;
        filesFailed += r.files.failed;
      }
    } catch (e) {
      failed += 1;
      failedSteps.push(name);
      console.error(`[data-retention] ${name} failed`, e);
    }
  }

  detail.filesDeleted = filesDeleted;
  detail.filesKeptStillReferenced = filesKept;
  detail.filesFailed = filesFailed;
  if (failedSteps.length) detail.failedSteps = failedSteps;

  return { processed, failed, hasMore, detail };
}

type SimpleModel =
  | "contactMessage"
  | "errorLog"
  | "checkoutSession"
  | "emailMessage"
  | "activityLog"
  | "customerNotification"
  | "staffNotification"
  | "adminNotification";

/** Find a bounded batch of ids, oldest first, then delete exactly those (still matching). */
async function deleteBatch(model: SimpleModel, where: object, take: number): Promise<StepResult> {
  // The delegates share findMany/deleteMany shapes; one cast keeps this to one helper.
  const delegate = prisma[model] as unknown as {
    findMany: (args: object) => Promise<{ id: string }[]>;
    deleteMany: (args: object) => Promise<{ count: number }>;
  };
  const rows = await delegate.findMany({ where, select: { id: true }, orderBy: { createdAt: "asc" }, take });
  if (rows.length === 0) return { deleted: 0, full: false };
  const { count } = await delegate.deleteMany({ where: { AND: [where, { id: { in: rows.map((r) => r.id) } }] } });
  return { deleted: count, full: rows.length >= take };
}
