import { NextRequest, NextResponse } from "next/server";
import { validateCronSecret } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/logger";
import { sendSmtpMail } from "@/lib/email-transport";
import { getPublicAppUrl } from "@/lib/app-url";
import {
  hasRecentBalanceReminder,
  notifyBalanceReminder,
} from "@/lib/customer-notifications";

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

function balanceReminderHtml(params: {
  firstName: string;
  outfitName: string;
  orderRef: string;
  balanceNGN: number;
  deliveryDate: string;
  payUrl: string;
}): string {
  return `
    <div style="font-family:Georgia,serif;background:#F7F2EC;padding:24px;color:#442913">
      <h1 style="color:#442913;margin:0 0 8px">A reminder about your outstanding balance</h1>
      <p>Hi ${params.firstName},</p>
      <p>You have an outstanding balance of <strong>₦${params.balanceNGN.toLocaleString("en-NG")}</strong> on your commission.</p>
      <p><strong>Commission:</strong> ${params.outfitName}<br/>
      <strong>Order:</strong> ${params.orderRef}<br/>
      <strong>Outstanding:</strong> ₦${params.balanceNGN.toLocaleString("en-NG")}<br/>
      <strong>Delivery:</strong> ${params.deliveryDate}</p>
      <p><a href="${params.payUrl}" style="display:inline-block;background:#442913;color:#E2D1C2;padding:12px 24px;text-decoration:none">Pay outstanding balance</a></p>
      <p style="margin-top:32px;font-size:12px;color:#98755B">Prudential Atelier · prudentgabriel.com</p>
    </div>
  `;
}

export async function POST(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = Date.now();
    const horizon = new Date(now + FOURTEEN_DAYS_MS);
    const appUrl = getPublicAppUrl();

    const orders = await prisma.bespokeOrder.findMany({
      where: {
        balance: { gt: 0 },
        deliveryDate: { lte: horizon, gte: new Date() },
        status: { not: "CANCELLED" },
      },
    });

    let sent = 0;
    for (const order of orders) {
      if (await hasRecentBalanceReminder(order.id)) continue;
      if (!order.deliveryDate) continue;

      const firstName = order.clientName.split(/\s+/)[0] ?? order.clientName;
      const deliveryDate = order.deliveryDate.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      const payUrl = `${appUrl}/track/${encodeURIComponent(order.trackingToken)}`;
      const outfitName = order.outfitDescription?.slice(0, 80) ?? "Your commission";

      await sendSmtpMail({
        to: order.clientEmail,
        subject: `Outstanding balance reminder — ${order.orderRef}`,
        html: balanceReminderHtml({
          firstName,
          outfitName,
          orderRef: order.orderRef,
          balanceNGN: order.balance,
          deliveryDate,
          payUrl,
        }),
      });

      notifyBalanceReminder({
        clientProfileId: order.clientProfileId,
        clientEmail: order.clientEmail,
        orderId: order.id,
        orderRef: order.orderRef,
        trackingToken: order.trackingToken,
        balanceNGN: order.balance,
      });

      sent += 1;
    }

    return NextResponse.json({ ok: true, sent });
  } catch (e) {
    await logError({
      severity: "CRITICAL",
      errorType: "CRON_BALANCE_REMINDERS",
      message: e instanceof Error ? e.message : "Balance reminders failed",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
