import type { BespokeStage } from "@prisma/client";
import {
  buildStageEmailData,
  getBespokeStageEmail,
  getBespokeStageEmailSubject,
  type StageEmailData,
} from "@/lib/email-templates/bespoke-stages";
import { sendSmtpMail } from "@/lib/email-transport";
import { getLogoSettings } from "@/lib/logos";

export async function sendBespokeStageEmail(
  stage: BespokeStage,
  data: StageEmailData,
  toEmail: string,
): Promise<void> {
  const { logoWhite } = await getLogoSettings();
  const html = getBespokeStageEmail(stage, data, logoWhite || undefined);
  const subject = getBespokeStageEmailSubject(stage, data.orderRef);
  await sendSmtpMail({ to: toEmail, subject, html });
}

export { buildStageEmailData };
export type { StageEmailData };
