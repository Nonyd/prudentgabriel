import { ActivityAction, ErrorSeverity } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { queueEmail } from "@/lib/email-outbox";
import { getAdminImpersonation } from "@/lib/admin-impersonate";

export async function logActivity(params: {
  userId?: string;
  userEmail?: string;
  userRole?: string;
  impersonatedUserId?: string;
  impersonatedEmail?: string;
  action: ActivityAction;
  module: string;
  description: string;
  recordId?: string;
  recordType?: string;
  ipAddress?: string;
  snapshot?: unknown;
}): Promise<void> {
  try {
    let impersonatedUserId = params.impersonatedUserId;
    let impersonatedEmail = params.impersonatedEmail;
    let userId = params.userId;
    let userEmail = params.userEmail;
    let userRole = params.userRole;

    if (!impersonatedUserId) {
      const ctx = await getAdminImpersonation(params.userRole, params.userEmail);
      if (ctx) {
        userId = ctx.actorId;
        userEmail = ctx.actorEmail;
        userRole = "SUPER_ADMIN";
        impersonatedUserId = ctx.targetId;
        impersonatedEmail = ctx.targetEmail;
      }
    }

    await prisma.activityLog.create({
      data: {
        userId,
        userEmail,
        userRole,
        impersonatedUserId,
        impersonatedEmail,
        action: params.action,
        module: params.module,
        description: params.description,
        recordId: params.recordId,
        recordType: params.recordType,
        ipAddress: params.ipAddress,
        snapshot: params.snapshot === undefined ? undefined : (params.snapshot as object),
      },
    });
  } catch (error) {
    console.error("[activity-log]", params, error);
  }
}

export async function logError(params: {
  severity: ErrorSeverity;
  errorType: string;
  message: string;
  stack?: string;
  userId?: string;
  orderId?: string;
  url?: string;
}): Promise<void> {
  try {
    await prisma.errorLog.create({ data: params });

    if (params.severity === "CRITICAL" && process.env.SUPER_ADMIN_EMAIL) {
      await queueEmail({
        to: process.env.SUPER_ADMIN_EMAIL,
        subject: `[Prudential Atelier] Critical error: ${params.errorType}`,
        html: `<p>${params.message}</p><pre>${params.stack ?? ""}</pre>`,
        template: "critical-error",
        idempotencyKey: `critical-error:${params.errorType}:${Date.now()}`,
      }).catch(() => undefined);
    }
  } catch (error) {
    console.error("[error-log]", params, error);
  }
}

/** Persist a thrown server failure to the admin Error Log. Always console.errors as well. */
export async function logServerError(params: {
  errorType: string;
  error: unknown;
  userId?: string;
  orderId?: string;
  url?: string;
  severity?: ErrorSeverity;
}): Promise<void> {
  const message = params.error instanceof Error ? params.error.message : String(params.error);
  const stack = params.error instanceof Error ? params.error.stack : undefined;
  console.error(`[${params.errorType}]`, params.error);
  await logError({
    severity: params.severity ?? "WARNING",
    errorType: params.errorType,
    message: message.slice(0, 4000),
    stack,
    userId: params.userId,
    orderId: params.orderId,
    url: params.url,
  });
}

export type { ActivityAction, ErrorSeverity };
