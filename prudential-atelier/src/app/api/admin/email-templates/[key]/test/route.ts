import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireGeneralAdminApi } from "@/lib/admin-auth";
import { EMAIL_TEMPLATE_BY_KEY, type EmailTemplateKey } from "@/lib/admin-email-catalog";
import { getEmailTemplate } from "@/lib/admin-email-template-store";
import { renderTemplateEmailHtml } from "@/lib/admin-email-render";
import { sendEmail } from "@/lib/email";

const bodySchema = z.object({
  to: z.string().email(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const gate = await requireGeneralAdminApi();
  if (!gate.ok) return gate.response;

  const { key } = await params;
  if (!EMAIL_TEMPLATE_BY_KEY[key as EmailTemplateKey]) {
    return NextResponse.json({ error: "Unknown template" }, { status: 404 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const template = await getEmailTemplate(key as EmailTemplateKey);
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const { subject, html } = await renderTemplateEmailHtml(template);
  await sendEmail({
    to: parsed.data.to,
    subject: `[TEST] ${subject}`,
    html,
    template: `template-test:${key}`,
    idempotencyKey: `template-test:${key}:${parsed.data.to}:${Date.now()}`,
  });

  return NextResponse.json({ success: true });
}
