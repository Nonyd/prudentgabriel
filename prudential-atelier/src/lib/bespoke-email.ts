import type { BespokeStage } from "@prisma/client";
import {
  buildStageEmailData,
  getBespokeStageEmail,
  type StageEmailData,
} from "@/lib/email-templates/bespoke-stages";
import { sendEmail } from "@/lib/email";
import { EMAIL_LOGO_PX } from "@/lib/customer-email";
import {
  EMAIL_ATELIER_LOGO_HEIGHT,
  EMAIL_ATELIER_LOGO_WIDTH,
  emailAtelierLogoDarkUrl,
  emailLogoDarkUrl,
  primeEmailBranding,
} from "@/lib/email-branding";
import { catalogCopy } from "@/lib/catalog-email";
import {
  BESPOKE_STAGE_EMAIL_KEYS,
  EMAIL_TEMPLATE_KEYS,
  type EmailTemplateKey,
} from "@/lib/admin-email-catalog";

export async function sendBespokeStageEmail(
  stage: BespokeStage,
  data: StageEmailData,
  toEmail: string,
): Promise<void> {
  const key = (BESPOKE_STAGE_EMAIL_KEYS[stage] ?? EMAIL_TEMPLATE_KEYS.ATELIER_STAGE_UPDATE) as EmailTemplateKey;
  const copy = await catalogCopy(key, {
    firstName: data.clientName.split(/\s+/)[0] ?? data.clientName,
    orderRef: data.orderRef,
    outfitName: data.stageName,
    stageName: data.stageName,
    link: data.trackingUrl,
  });
  await primeEmailBranding();
  const logo = emailAtelierLogoDarkUrl
    ? { url: emailAtelierLogoDarkUrl, width: EMAIL_ATELIER_LOGO_WIDTH, height: EMAIL_ATELIER_LOGO_HEIGHT }
    : emailLogoDarkUrl
      ? { url: emailLogoDarkUrl, width: EMAIL_LOGO_PX, height: EMAIL_LOGO_PX }
      : undefined;
  const html = getBespokeStageEmail(stage, data, logo, {
    heading: copy.heading,
    intro: copy.body1,
    ctaLabel: copy.ctaLabel || "Track Your Order",
    ctaLink: copy.ctaLink || data.trackingUrl,
  });
  await sendEmail({
    to: toEmail,
    subject: copy.subject,
    html,
    template: "stage-complete",
    idempotencyKey: `stage-complete:${data.orderRef}:${stage}`,
    relatedType: "BespokeOrder",
    relatedId: data.orderRef,
  });
}

export { buildStageEmailData };
export type { StageEmailData };
