import { ActivityAction, ErrorSeverity } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { queueEmail } from "@/lib/email-outbox";

export async function logActivity(params: {
  userId?: string;
  userEmail?: string;
  userRole?: string;
  action: ActivityAction;
  module: string;
  description: string;
  recordId?: string;
  recordType?: string;
  ipAddress?: string;
}): Promise<void> {
  try {
    await prisma.activityLog.create({ data: params });
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

export type { ActivityAction, ErrorSeverity };
