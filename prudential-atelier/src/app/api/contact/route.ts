import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
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

  const { name, email, subject, message } = parsed.data;
  const admin = process.env.ADMIN_EMAIL ?? "hello@prudentgabriel.com";

  await sendEmail({
    to: admin,
    subject: `[Contact] ${subject} — ${name}`,
    html: `<p>From: ${name} &lt;${email}&gt;</p><p>${message.replace(/</g, "&lt;")}</p>`,
  });

  return NextResponse.json({ success: true });
}
