import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireAdminApi } from "@/lib/admin-auth";
import { getSettings } from "@/lib/settings";
import { queueEmail } from "@/lib/email-outbox";
import { resolveCustomerFromName } from "@/lib/customer-email";
import { EMAIL_FROM } from "@/lib/email-transport";

export async function POST() {
  const gate = await requireAdminApi("settings.developer");
  if (!gate.ok) return gate.response;

  const emailSettings = await getSettings("EMAIL");
  const to = emailSettings.admin_notification_email?.trim() || emailSettings.email_from_address?.trim();
  if (!to) {
    return NextResponse.json({ error: "Set admin notification or from email first" }, { status: 400 });
  }

  const fromName = resolveCustomerFromName(emailSettings.email_from_name);
  const fromAddr = emailSettings.email_from_address?.trim() || "noreply@prudentgabriel.com";
  const from = `"${fromName}" <${fromAddr}>`;

  const queued = await queueEmail({
    to,
    fromAddress: from || EMAIL_FROM,
    subject: "Prudent Gabriel — test email",
    html: "<p>This is a test message from your admin settings.</p>",
    text: "This is a test message from your admin settings.",
    template: "admin-settings-test",
    idempotencyKey: `admin-settings-test:${randomUUID()}`,
  });

  return NextResponse.json({
    success: true,
    message: `Test email queued for ${to}`,
    id: queued.id,
  });
}
