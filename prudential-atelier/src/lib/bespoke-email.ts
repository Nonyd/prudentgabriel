import type { BespokeStage } from "@prisma/client";
import {
  buildStageEmailData,
  getBespokeStageEmail,
  getBespokeStageEmailSubject,
  type StageEmailData,
} from "@/lib/email-templates/bespoke-stages";
import { sendSmtpMail } from "@/lib/email-transport";

export async function sendBespokeStageEmail(
  stage: BespokeStage,
  data: StageEmailData,
  toEmail: string,
): Promise<void> {
  const html = getBespokeStageEmail(stage, data);
  const subject = getBespokeStageEmailSubject(stage, data.orderRef);
  await sendSmtpMail({ to: toEmail, subject, html });
}

export { buildStageEmailData };
export type { StageEmailData };
