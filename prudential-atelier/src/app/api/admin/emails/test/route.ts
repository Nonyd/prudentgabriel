import { NextResponse } from "next/server";
import { Resend } from "resend";
import { requireAdminApi } from "@/lib/admin-auth";
import { getSettings } from "@/lib/settings";

export async function POST() {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const emailSettings = await getSettings("EMAIL");
  const to = emailSettings.admin_notification_email?.trim() || emailSettings.email_from_address?.trim();
  if (!to) {
    return NextResponse.json({ error: "Set admin notification or from email first" }, { status: 400 });
  }

  const provider = (emailSettings.email_provider ?? "resend").toLowerCase();
  const fromName = emailSettings.email_from_name?.trim() || "Prudent Gabriel";
  const fromAddr = emailSettings.email_from_address?.trim() || "hello@prudentgabriel.com";
  const from = `${fromName} <${fromAddr}>`;

  if (provider === "resend") {
    const key = emailSettings.resend_api_key?.trim() || process.env.RESEND_API_KEY?.trim();
    if (!key) {
      return NextResponse.json({ error: "Resend API key not configured" }, { status: 400 });
    }
    const resend = new Resend(key);
    const { error } = await resend.emails.send({
      from,
      to,
      subject: "Prudent Gabriel — test email",
      text: "This is a test message from your admin settings.",
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, message: `Test email sent to ${to}` });
  }

  return NextResponse.json(
    { error: "Test send for this provider is not implemented yet. Use Resend for testing." },
    { status: 501 },
  );
}
