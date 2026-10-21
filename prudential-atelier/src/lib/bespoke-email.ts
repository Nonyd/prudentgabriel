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
  /** The step completed — the email is sent once per step, so a custom step is not mistaken for another. */
  orderStageId?: string,
): Promise<void> {
  const builtIn = BESPOKE_STAGE_EMAIL_KEYS[stage as keyof typeof BESPOKE_STAGE_EMAIL_KEYS] as EmailTemplateKey | undefined;
  // Custom steps use the generic stage update, which names the step ({{stageName}}).
  const key = builtIn ?? EMAIL_TEMPLATE_KEYS.ATELIER_STAGE_UPDATE;
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
    // Built-in steps keep their old key (one per stage per order); custom steps key by the step.
    idempotencyKey: `stage-complete:${data.orderRef}:${builtIn || !orderStageId ? stage : orderStageId}`,
    relatedType: "BespokeOrder",
    relatedId: data.orderRef,
  });
}

export { buildStageEmailData };
export type { StageEmailData };
