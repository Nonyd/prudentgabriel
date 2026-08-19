import type { BespokeStage } from "@prisma/client";
import {
  buildStageEmailData,
  getBespokeStageEmail,
  getBespokeStageEmailSubject,
  type StageEmailData,
} from "@/lib/email-templates/bespoke-stages";
import { sendEmail } from "@/lib/email";
import { getLogoSettings } from "@/lib/logos";

export async function sendBespokeStageEmail(
  stage: BespokeStage,
  data: StageEmailData,
  toEmail: string,
): Promise<void> {
  const { logoWhite } = await getLogoSettings();
  const html = getBespokeStageEmail(stage, data, logoWhite || undefined);
  const subject = getBespokeStageEmailSubject(stage, data.orderRef);
  await sendEmail({
    to: toEmail,
    subject,
    html,
    template: "stage-complete",
    idempotencyKey: `stage-complete:${data.orderRef}:${stage}`,
    relatedType: "BespokeOrder",
    relatedId: data.orderRef,
  });
}

export { buildStageEmailData };
export type { StageEmailData };
