import { render } from "@react-email/render";
import BrandedHtmlEmail from "@/emails/BrandedHtmlEmail";
import CollectionCampaignEmail, { type CampaignProduct } from "@/emails/CollectionCampaignEmail";
import ComposableTemplateEmail from "@/emails/ComposableTemplateEmail";
import { primeEmailBranding } from "@/lib/email-branding";
import {
  demoTemplateVariables,
  interpolateTemplateText,
  type EmailTemplateFields,
} from "@/lib/admin-email-catalog";
import { getPublicAppUrl } from "@/lib/app-url";
import { optimizeImageUrl } from "@/lib/utils";

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

export async function renderCollectionCampaignHtml(params: {
  fields: EmailTemplateFields;
  collectionName: string;
  collectionSlug: string;
  coverImage: string | null;
  coverImageAlt: string | null;
  products: CampaignProduct[];
}): Promise<{ subject: string; html: string }> {
  await primeEmailBranding();
  const collectionUrl = `${getPublicAppUrl()}/collections/${params.collectionSlug}`;
  const vars = {
    ...demoTemplateVariables(),
    collectionName: params.collectionName,
    collectionUrl,
  };
  const subject = interpolateTemplateText(params.fields.subject, vars);
  const heading = interpolateTemplateText(params.fields.heading, vars);
  const body1 = interpolateTemplateText(params.fields.body_1, vars);
  const body2 = params.fields.body_2 ? interpolateTemplateText(params.fields.body_2, vars) : "";
  const ctaLabel = interpolateTemplateText(params.fields.cta_label || "Shop the collection", vars);
  const ctaLink = interpolateTemplateText(params.fields.cta_link || collectionUrl, vars);
  const footerNote = params.fields.footer_note
    ? interpolateTemplateText(params.fields.footer_note, vars)
    : "";
  const heroUrl = params.coverImage ? optimizeImageUrl(params.coverImage, 600) : null;

  const html = await render(
    <CollectionCampaignEmail
      heading={heading}
      body1={body1}
      body2={body2 || undefined}
      heroUrl={heroUrl}
      heroAlt={params.coverImageAlt || params.collectionName}
      products={params.products}
      ctaLabel={ctaLabel}
      ctaLink={ctaLink}
      shopBaseUrl={getPublicAppUrl()}
      footerNote={footerNote || undefined}
    />,
  );

  return { subject, html };
}
