import type { BespokeStage } from "@prisma/client";
import { STAGE_LABELS, STAGE_SHORT_LABELS, getStageProgress } from "@/lib/bespoke-stages";

export interface StageEmailData {
  clientName: string;
  orderRef: string;
  stageName: string;
  stageNumber: number;
  notes: string;
  images: string[];
  videos: string[];
  trackingUrl: string;
  deliveryDate?: string;
}

const STAGE_SUBJECTS: Record<BespokeStage, string> = {
  CONSULTATION_BOOKING: "Your consultation is confirmed — Prudential Atelier",
  CONSULTATION_SESSION: "Your consultation summary — {orderRef}",
  INVOICE_ISSUANCE: "Your quote is ready for review — {orderRef}",
  PAYMENT_CONFIRMATION: "Payment received — your order begins now",
  SKETCHING_CONCEPT: "Your design concept is ready — {orderRef}",
  FABRIC_SOURCING: "Your fabrics have been sourced — {orderRef}",
  DESIGN_APPROVAL: "Please review your final design — {orderRef}",
  TAILORING: "Your outfit is being crafted — {orderRef}",
  FIRST_FITTING: "Your first fitting summary — {orderRef}",
  ALTERATIONS: "Alterations complete — {orderRef}",
  BEADING_FINISHING: "The finishing touches are underway — {orderRef}",
  FINAL_FITTING: "Final fitting approved — {orderRef}",
  DELIVERY: "Your outfit is ready — {orderRef}",
};

const STAGE_INTROS: Record<BespokeStage, string> = {
  CONSULTATION_BOOKING:
    "Your consultation has been confirmed. We look forward to understanding your vision and crafting something extraordinary for you.",
  CONSULTATION_SESSION:
    "Thank you for your consultation session. Here is a summary of what we discussed and the direction for your bespoke piece.",
  INVOICE_ISSUANCE:
    "Your personalised quote is ready for review. Please take a moment to review the details and approve when you are ready to proceed.",
  PAYMENT_CONFIRMATION:
    "We have received your payment. Your bespoke order is now officially in production — our atelier team has begun work on your piece.",
  SKETCHING_CONCEPT:
    "Our design team has prepared initial concepts for your outfit. We hope these capture the vision we discussed together.",
  FABRIC_SOURCING:
    "We have sourced the fabrics for your order. Each material has been carefully selected to match your design and quality expectations.",
  DESIGN_APPROVAL:
    "Your final design plan is ready for your review. Please confirm that everything meets your expectations before we proceed to construction.",
  TAILORING:
    "Your outfit is now being crafted in our atelier. Our tailors are bringing your design to life with meticulous attention to detail.",
  FIRST_FITTING:
    "Your first fitting has been completed. Below are the notes from your fitting session and any adjustments we will be making.",
  ALTERATIONS:
    "All requested alterations have been completed. Your garment has been refined to ensure the perfect fit and finish.",
  BEADING_FINISHING:
    "Our embellishment team is applying the finishing touches — beading, embroidery, and final details that make your piece truly yours.",
  FINAL_FITTING:
    "Your final fitting has been approved. Your outfit meets our standards and yours — we are preparing it for delivery.",
  DELIVERY:
    "Your bespoke outfit is ready! We cannot wait for you to experience the finished piece. Details for collection or delivery are below.",
};

function emailWrapper(content: string, logoUrl?: string): string {
  const header = logoUrl
    ? `<img src="${logoUrl}" alt="Prudential Atelier" width="160" style="max-width:160px;height:auto;margin:0 auto;display:block;" />`
    : `<p style="margin:0;font-size:22px;letter-spacing:0.15em;color:#442913;">PRUDENTIAL ATELIER</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#F7F2EC;font-family:Georgia,'Times New Roman',serif;color:#442913;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F2EC;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #D4BBAC;">
        <tr><td style="padding:32px 40px 16px;text-align:center;">
          ${header}
          <div style="height:2px;width:60px;background:#98755B;margin:16px auto 0;"></div>
        </td></tr>
        <tr><td style="padding:8px 40px 32px;">${content}</td></tr>
        <tr><td style="padding:24px 40px;background:#F7F2EC;border-top:1px solid #D4BBAC;text-align:center;">
          <p style="margin:0;font-size:11px;color:#98755B;line-height:1.6;">
            Prudential Atelier · prudentgabriel.com<br/>
            Developed with love by SonsHub Media Ltd
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function buildImageGrid(images: string[]): string {
  if (images.length === 0) return "";
  const shown = images.slice(0, 4);
  const cells = shown
    .map(
      (url) =>
        `<td style="padding:4px;"><img src="${url}" alt="Progress" width="130" height="130" style="display:block;object-fit:cover;border:1px solid #D4BBAC;"/></td>`,
    )
    .join("");
  return `<table cellpadding="0" cellspacing="0" style="margin:20px 0;"><tr>${cells}</tr></table>`;
}

function buildVideoNote(videos: string[]): string {
  if (videos.length === 0) return "";
  const links = videos
    .map(
      (url, i) =>
        `<a href="${url}" style="color:#98755B;">View progress video ${videos.length > 1 ? i + 1 : ""}</a>`,
    )
    .join(" · ");
  return `<p style="margin:16px 0 0;font-size:14px;color:#5C3422;">View progress videos: ${links}</p>`;
}

export function getBespokeStageEmailSubject(stage: BespokeStage, orderRef: string): string {
  return STAGE_SUBJECTS[stage].replace("{orderRef}", orderRef);
}

export function getBespokeStageEmail(stage: BespokeStage, data: StageEmailData, logoUrl?: string): string {
  const intro = STAGE_INTROS[stage];
  const stageLabel = STAGE_LABELS[stage];
  const deliveryLine = data.deliveryDate
    ? `<p style="margin:12px 0 0;font-size:14px;color:#5C3422;"><strong>Expected delivery:</strong> ${data.deliveryDate}</p>`
    : "";

  const content = `
    <p style="margin:0 0 8px;font-size:14px;color:#98755B;text-transform:uppercase;letter-spacing:0.1em;">Order ${data.orderRef}</p>
    <h1 style="margin:0 0 16px;font-size:24px;font-weight:normal;color:#442913;">Dear ${data.clientName},</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#442913;">${intro}</p>
    <p style="margin:0 0 8px;font-size:13px;color:#98755B;font-weight:bold;">${stageLabel}</p>
    <div style="margin:16px 0;padding:16px;background:#F7F2EC;border-left:3px solid #98755B;">
      <p style="margin:0;font-size:14px;line-height:1.7;color:#442913;white-space:pre-wrap;">${data.notes}</p>
    </div>
    ${buildImageGrid(data.images)}
    ${buildVideoNote(data.videos)}
    ${deliveryLine}
    <p style="margin:28px 0 0;text-align:center;">
      <a href="${data.trackingUrl}" style="display:inline-block;padding:14px 32px;background:#5C3422;color:#E2D1C2;text-decoration:none;font-size:13px;letter-spacing:0.08em;">Track Your Order</a>
    </p>
  `;

  return emailWrapper(content, logoUrl);
}

export function buildStageEmailData(params: {
  clientName: string;
  orderRef: string;
  stage: BespokeStage;
  notes: string;
  images: string[];
  videos: string[];
  trackingToken: string;
  deliveryDate?: Date | null;
}): StageEmailData {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://prudentgabriel.com";
  return {
    clientName: params.clientName,
    orderRef: params.orderRef,
    stageName: STAGE_SHORT_LABELS[params.stage],
    stageNumber: getStageProgress(params.stage),
    notes: params.notes,
    images: params.images,
    videos: params.videos,
    trackingUrl: `${baseUrl}/track/${params.trackingToken}`,
    deliveryDate: params.deliveryDate
      ? params.deliveryDate.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : undefined,
  };
}
