import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { cmsGet, getCMSContent } from "@/lib/cms";
import { createNotification } from "@/lib/notifications";
import { contactSchema } from "@/validations/contact";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, email, phone, subject, message } = parsed.data;

  let cms: Record<string, string> = {};
  try {
    cms = await getCMSContent(["contact_notification_email", "contact_auto_reply_message"]);
  } catch {
    /* fall back to env */
  }

  const contactEmail =
    cmsGet(cms, "contact_notification_email", "") ||
    process.env.ADMIN_EMAIL ||
    "hello@prudentgabriel.com";
  const autoReplyMessage = cmsGet(
    cms,
    "contact_auto_reply_message",
    "Thank you for reaching out. We'll be in touch within 24 hours.",
  );

  const safeMessage = message.replace(/</g, "&lt;");

  await sendEmail({
    to: contactEmail,
    subject: `New contact: ${subject} — ${name}`,
    html: `
      <h2>New Contact Form Submission</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone || "Not provided"}</p>
      <p><strong>Subject:</strong> ${subject}</p>
      <p><strong>Message:</strong></p>
      <p>${safeMessage}</p>
    `,
  });

  await sendEmail({
    to: email,
    subject: "We received your message — Prudential Atelier",
    html: `
      <p>Thank you for reaching out, ${name}.</p>
      <p>${autoReplyMessage.replace(/</g, "&lt;")}</p>
      <p>— Prudential Atelier</p>
    `,
  });

  await createNotification({
    type: "CONTACT_FORM",
    title: "New contact message",
    message: `${name} — ${subject}`,
    link: "/admin/clients",
  }).catch(() => {});

  return NextResponse.json({ success: true });
}
