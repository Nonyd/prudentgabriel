import { NextRequest, NextResponse } from "next/server";
import { StageApprovalStatus } from "@prisma/client";
import { validateCronSecret } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/logger";
import { getPublicAppUrl } from "@/lib/app-url";
import { STAGE_SHORT_LABELS } from "@/lib/bespoke-stages";
import { sendStageApprovalReminderEmail } from "@/lib/email";
import { createClientNotification, resolveUserIdByEmail } from "@/lib/customer-notifications";

const SEVENTY_TWO_HOURS_MS = 72 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const cutoff = new Date(Date.now() - SEVENTY_TWO_HOURS_MS);
    const pending = await prisma.stageApproval.findMany({
      where: {
        status: StageApprovalStatus.PENDING,
        reminderSentAt: null,
        requestedAt: { lte: cutoff },
      },
      include: {
        order: {
          select: {
            id: true,
            orderRef: true,
            clientName: true,
            clientEmail: true,
            clientProfileId: true,
          },
        },
      },
    });

    let sent = 0;
    const appUrl = getPublicAppUrl();
    for (const row of pending) {
      const approveUrl = `${appUrl}/account/orders/bespoke/${row.order.id}`;
      try {
        await sendStageApprovalReminderEmail({
          to: row.order.clientEmail,
          clientName: row.order.clientName,
          orderRef: row.order.orderRef,
          stageLabel: STAGE_SHORT_LABELS[row.stage],
          approveUrl,
        });
        const userId =
          (row.order.clientProfileId
            ? (
                await prisma.clientProfile.findUnique({
                  where: { id: row.order.clientProfileId },
                  select: { userId: true },
                })
              )?.userId
            : null) ?? (await resolveUserIdByEmail(row.order.clientEmail));
        if (userId) {
          await createClientNotification({
            userId,
            type: "STAGE_APPROVAL_REQUESTED",
            title: "Reminder: commission review",
            message: `${row.order.orderRef} — ${STAGE_SHORT_LABELS[row.stage]} is still waiting for your approval.`,
            link: `/account/orders/bespoke/${row.order.id}`,
            entityId: row.id,
          });
        }
        await prisma.stageApproval.update({
          where: { id: row.id },
          data: { reminderSentAt: new Date() },
        });
        sent += 1;
      } catch (e) {
        console.error("[stage-approval-reminder]", row.id, e);
      }
    }

    return NextResponse.json({ sent, scanned: pending.length });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "STAGE_APPROVAL_REMINDER",
      message: e instanceof Error ? e.message : "Reminder cron failed",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
