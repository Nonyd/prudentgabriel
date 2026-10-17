import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { getDashboardSecret } from "@/lib/credential-catalog";
import { RESEND_WEBHOOK_SECRET_KEY } from "@/lib/email-settings-bootstrap";
import { markProviderDeliveryFailure } from "@/lib/email-outbox";
import { ensureEmailPreference } from "@/lib/email-consent";

/**
 * Resend reports what happened after it accepted a message: bounces, failures, suppressions
 * and spam complaints. Without this the outbox only knows "SENT".
 */
export async function POST(req: NextRequest) {
  const secret = await getDashboardSecret(RESEND_WEBHOOK_SECRET_KEY);
  if (!secret) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 503 });
  }

  const payload = await req.text();
  let event;
  try {
    // verify() makes no API call; the constructor only insists on a key being present.
    event = new Resend("re_webhook_verify_only").webhooks.verify({
      payload,
      headers: {
        id: req.headers.get("svix-id") ?? req.headers.get("webhook-id") ?? "",
        timestamp: req.headers.get("svix-timestamp") ?? req.headers.get("webhook-timestamp") ?? "",
        signature: req.headers.get("svix-signature") ?? req.headers.get("webhook-signature") ?? "",
      },
      webhookSecret: secret,
    });
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  switch (event.type) {
    case "email.bounced": {
      const b = event.data.bounce;
      const kind = [b?.type, b?.subType].filter(Boolean).join("/");
      await markProviderDeliveryFailure({
        provider: "resend",
        providerMessageId: event.data.email_id,
        reason: `Bounced${kind ? ` (${kind})` : ""}: ${b?.message ?? "the recipient's server rejected it"}`,
        suppressRecipient: b?.type === "Permanent",
      });
      break;
    }
    case "email.failed":
      await markProviderDeliveryFailure({
        provider: "resend",
        providerMessageId: event.data.email_id,
        reason: `Resend could not send: ${event.data.failed?.reason ?? "unknown reason"}`,
        suppressRecipient: false,
      });
      break;
    case "email.suppressed":
      await markProviderDeliveryFailure({
        provider: "resend",
        providerMessageId: event.data.email_id,
        reason: `Suppressed by Resend (address bounced or complained before): ${event.data.suppressed?.message ?? ""}`.trim(),
        suppressRecipient: true,
      });
      break;
    case "email.complained":
      // Delivered, but marked as spam: stop marketing mail to them.
      for (const to of event.data.to ?? []) {
        const pref = await ensureEmailPreference(to);
        if (!pref.unsubscribedAt) {
          await prisma.emailPreference.update({
            where: { id: pref.id },
            data: { unsubscribedAt: new Date() },
          });
        }
      }
      break;
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
