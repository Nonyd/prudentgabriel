import { queueEmail } from "@/lib/email-outbox";
import { logError } from "@/lib/logger";
import { renderTemplateEmailHtml } from "@/lib/admin-email-render";
import { getEmailTemplate } from "@/lib/admin-email-template-store";
import {
  EMAIL_TEMPLATE_BY_KEY,
  interpolateTemplateText,
  type EmailTemplateKey,
} from "@/lib/admin-email-catalog";

export async function catalogCopy(key: EmailTemplateKey, vars: Record<string, string>) {
  const stored = await getEmailTemplate(key);
  const fields = stored ?? EMAIL_TEMPLATE_BY_KEY[key].defaults;
  return {
    subject: interpolateTemplateText(fields.subject, vars),
    heading: interpolateTemplateText(fields.heading, vars),
    body1: interpolateTemplateText(fields.body_1, vars),
    body2: fields.body_2 ? interpolateTemplateText(fields.body_2, vars) : "",
    ctaLabel: fields.cta_label ? interpolateTemplateText(fields.cta_label, vars) : "",
    ctaLink: fields.cta_link ? interpolateTemplateText(fields.cta_link, vars) : "",
    footerNote: fields.footer_note ? interpolateTemplateText(fields.footer_note, vars) : "",
  };
}

export async function sendUsingCatalog(params: {
  key: EmailTemplateKey;
  to: string;
  vars: Record<string, string>;
  outboxTemplate: string;
  idempotencyKey: string;
  relatedType?: string;
  relatedId?: string;
  extraHtml?: string;
  priority?: number;
}): Promise<{ created: boolean }> {
  try {
    const stored = await getEmailTemplate(params.key);
    const fields = stored ?? EMAIL_TEMPLATE_BY_KEY[params.key].defaults;
    const { subject, html } = await renderTemplateEmailHtml(fields, params.vars, params.extraHtml);
    const queued = await queueEmail({
      to: params.to,
      subject,
      html,
      template: params.outboxTemplate,
      idempotencyKey: params.idempotencyKey,
      relatedType: params.relatedType,
      relatedId: params.relatedId,
      priority: params.priority,
    });
    return { created: queued.created };
  } catch (error) {
    await logError({
      severity: "WARNING",
      errorType: "EMAIL_QUEUE",
      message: `${params.outboxTemplate}: ${error instanceof Error ? error.message : "catalog send failed"}`,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return { created: false };
  }
}
