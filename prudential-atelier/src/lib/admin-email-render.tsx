import { render } from "@react-email/render";
import BrandedHtmlEmail from "@/emails/BrandedHtmlEmail";
import ComposableTemplateEmail from "@/emails/ComposableTemplateEmail";
import { primeEmailBranding } from "@/lib/email-branding";
import {
  demoTemplateVariables,
  interpolateTemplateText,
  type EmailTemplateFields,
} from "@/lib/admin-email-catalog";

export async function renderTemplateEmailHtml(
  template: EmailTemplateFields,
  vars: Record<string, string> = demoTemplateVariables(),
): Promise<{ subject: string; html: string }> {
  await primeEmailBranding();

  const subject = interpolateTemplateText(template.subject, vars);
  const heading = interpolateTemplateText(template.heading, vars);
  const body1 = interpolateTemplateText(template.body_1, vars);
  const body2 = template.body_2 ? interpolateTemplateText(template.body_2, vars) : "";
  const ctaLabel = template.cta_label ? interpolateTemplateText(template.cta_label, vars) : "";
  const ctaLink = template.cta_link ? interpolateTemplateText(template.cta_link, vars) : "";
  const footerNote = template.footer_note ? interpolateTemplateText(template.footer_note, vars) : "";

  const html = await render(
    <ComposableTemplateEmail
      heading={heading}
      body1={body1}
      body2={body2 || undefined}
      ctaLabel={ctaLabel || undefined}
      ctaLink={ctaLink || undefined}
      footerNote={footerNote || undefined}
    />,
  );

  return { subject, html };
}

export async function renderCustomEmailHtml(subject: string, bodyHtml: string): Promise<string> {
  await primeEmailBranding();
  return render(<BrandedHtmlEmail previewText={subject} bodyHtml={bodyHtml} />);
}
