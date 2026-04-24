import { render } from "@react-email/render";
import { Resend } from "resend";
import WelcomeEmail, { subject as welcomeSubject } from "@/emails/WelcomeEmail";
import OrderConfirmationEmail from "@/emails/OrderConfirmationEmail";
import type { OrderItemLine } from "@/emails/OrderConfirmationEmail";
import OrderShippedEmail from "@/emails/OrderShippedEmail";
import BespokeConfirmationEmail from "@/emails/BespokeConfirmationEmail";
import PasswordResetEmail from "@/emails/PasswordResetEmail";
import ReferralSuccessEmail from "@/emails/ReferralSuccessEmail";
import BackInStockEmail from "@/emails/BackInStockEmail";
import ConsultationPendingEmail from "@/emails/ConsultationPendingEmail";
import ConsultationConfirmedEmail from "@/emails/ConsultationConfirmedEmail";
import ConsultationCancelledEmail from "@/emails/ConsultationCancelledEmail";
import ConsultationRescheduleEmail from "@/emails/ConsultationRescheduleEmail";
import { getPublicAppUrl } from "@/lib/app-url";
const FROM = "Prudential Atelier <hello@prudentgabriel.com>";

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export async function sendEmail(params: { to: string; subject: string; html: string }): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.log("[EMAIL]", params.to, params.subject);
    return;
  }
  try {
    await resend.emails.send({ from: FROM, to: params.to, subject: params.subject, html: params.html });
  } catch (e) {
    console.warn("[EMAIL] send failed", e);
  }
}

export async function sendWelcomeEmail(
  to: string,
  firstName: string,
  pointsBalance: number,
  referralCode: string,
): Promise<void> {
  const html = await render(
    <WelcomeEmail firstName={firstName} pointsBalance={pointsBalance} referralCode={referralCode} />,
  );
  await sendEmail({ to, subject: welcomeSubject(firstName), html });
}

export async function sendOrderConfirmationEmail(params: {
  to: string;
  firstName: string;
  orderNumber: string;
  items: OrderItemLine[];
  totalNGN: number;
  shippingNGN: number;
  discountNGN: number;
  pointsDiscNGN: number;
  subtotalNGN?: number;
  addressSnapshot?: Record<string, string>;
  estimatedDays?: string;
}): Promise<void> {
  const subtotal =
    params.subtotalNGN ??
    params.items.reduce((s, i) => s + i.priceNGN * i.qty, 0);
  const html = await render(
    <OrderConfirmationEmail
      firstName={params.firstName}
      orderNumber={params.orderNumber}
      items={params.items}
      subtotalNGN={subtotal}
      shippingNGN={params.shippingNGN}
      discountNGN={params.discountNGN}
      pointsDiscNGN={params.pointsDiscNGN}
      totalNGN={params.totalNGN}
      addressSnapshot={params.addressSnapshot}
      estimatedDays={params.estimatedDays}
    />,
  );
  await sendEmail({
    to: params.to,
    subject: `Order Confirmed — #${params.orderNumber} | Prudential Atelier`,
    html,
  });
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const html = await render(<PasswordResetEmail resetUrl={resetUrl} />);
  await sendEmail({
    to,
    subject: "Reset your Prudential Atelier password",
    html,
  });
}

export async function sendBespokeConfirmationEmail(
  to: string,
  name: string,
  requestNumber: string,
  occasion: string,
  timeline: string,
): Promise<void> {
  const html = await render(
    <BespokeConfirmationEmail name={name} requestNumber={requestNumber} occasion={occasion} timeline={timeline} />,
  );
  await sendEmail({
    to,
    subject: `Bespoke Request Received — ${requestNumber}`,
    html,
  });
}

export async function sendReferralSuccessEmail(
  to: string,
  referrerName: string,
  friendFirstName: string,
  pointsEarned: number,
  newBalance: number,
): Promise<void> {
  const html = await render(
    <ReferralSuccessEmail
      referrerName={referrerName}
      friendFirstName={friendFirstName}
      pointsEarned={pointsEarned}
      newBalance={newBalance}
    />,
  );
  await sendEmail({
    to,
    subject: `You just earned ${pointsEarned} points!`,
    html,
  });
}

export async function sendOrderShippedEmail(params: {
  to: string;
  firstName: string;
  orderNumber: string;
  trackingNumber?: string;
  carrier?: string;
  estimatedDays?: string;
}): Promise<void> {
  const html = await render(
    <OrderShippedEmail
      firstName={params.firstName}
      orderNumber={params.orderNumber}
      trackingNumber={params.trackingNumber}
      carrier={params.carrier}
      estimatedDays={params.estimatedDays}
    />,
  );
  await sendEmail({
    to: params.to,
    subject: `Your order has shipped — #${params.orderNumber}`,
    html,
  });
}

export async function sendBackInStockEmail(params: {
  to: string;
  productName: string;
  size: string;
  productSlug: string;
  priceNGN: number;
}): Promise<void> {
  const html = await render(
    <BackInStockEmail
      productName={params.productName}
      size={params.size}
      productSlug={params.productSlug}
      priceNGN={params.priceNGN}
    />,
  );
  await sendEmail({
    to: params.to,
    subject: `${params.productName} is back in stock`,
    html,
  });
}

function wrapHtml(title: string, inner: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="margin:0;background:#FAF6EF;font-family:Georgia,serif;color:#2d2d2d;">
<div style="background:#6B1C2A;padding:20px;text-align:center;">
  <span style="color:#C9A84C;font-size:18px;">${title}</span>
</div>
<div style="padding:28px 24px;max-width:560px;margin:0 auto;">${inner}</div>
</body></html>`;
}

export async function sendAdminNotificationEmail(subject: string, htmlInner: string): Promise<void> {
  const admin = process.env.ADMIN_EMAIL;
  if (!admin) {
    console.log("[EMAIL admin]", subject);
    return;
  }
  await sendEmail({ to: admin, subject, html: wrapHtml("Admin", htmlInner) });
}

export async function sendConsultationPendingEmail(params: {
  to: string;
  clientName: string;
  bookingNumber: string;
  consultantName: string;
  sessionTypeLabel: string;
  deliveryModeLabel: string;
  feeNGN: number;
  preferredDate1?: Date;
  preferredDate2?: Date;
  preferredDate3?: Date;
}): Promise<void> {
  const html = await render(
    <ConsultationPendingEmail
      clientName={params.clientName}
      bookingNumber={params.bookingNumber}
      consultantName={params.consultantName}
      sessionTypeLabel={params.sessionTypeLabel}
      deliveryModeLabel={params.deliveryModeLabel}
      feeNGN={params.feeNGN}
      preferredDate1={params.preferredDate1?.toISOString()}
      preferredDate2={params.preferredDate2?.toISOString()}
      preferredDate3={params.preferredDate3?.toISOString()}
    />,
  );
  await sendEmail({
    to: params.to,
    subject: `Consultation Request Received — #${params.bookingNumber} | Prudential Atelier`,
    html,
  });
}

export async function sendConsultationConfirmedEmail(params: {
  to: string;
  clientName: string;
  bookingNumber: string;
  consultantName: string;
  sessionTypeLabel: string;
  deliveryModeLabel: string;
  confirmedDate: Date;
  confirmedTime: string;
  durationMinutes: number;
  meetingLink?: string;
  meetingPlatform?: string;
  atelierAddress?: string;
  isVirtual: boolean;
}): Promise<void> {
  const dateLabel = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Lagos",
  }).format(params.confirmedDate);
  const html = await render(
    <ConsultationConfirmedEmail
      clientName={params.clientName}
      bookingNumber={params.bookingNumber}
      consultantName={params.consultantName}
      sessionTypeLabel={params.sessionTypeLabel}
      deliveryModeLabel={params.deliveryModeLabel}
      confirmedDate={params.confirmedDate.toISOString()}
      confirmedTime={params.confirmedTime}
      durationMinutes={params.durationMinutes}
      isVirtual={params.isVirtual}
      meetingLink={params.meetingLink}
      meetingPlatform={params.meetingPlatform}
      atelierAddress={params.atelierAddress}
    />,
  );
  await sendEmail({
    to: params.to,
    subject: `Consultation Confirmed — #${params.bookingNumber} · ${dateLabel} | Prudential Atelier`,
    html,
  });
}

export async function sendConsultationCancelledEmail(params: {
  to: string;
  clientName: string;
  bookingNumber: string;
  consultantName: string;
  reason?: string;
}): Promise<void> {
  const html = await render(
    <ConsultationCancelledEmail
      clientName={params.clientName}
      bookingNumber={params.bookingNumber}
      consultantName={params.consultantName}
      reason={params.reason}
    />,
  );
  await sendEmail({
    to: params.to,
    subject: `Consultation Cancelled — #${params.bookingNumber}`,
    html,
  });
}

export async function sendConsultationRescheduleEmail(params: {
  to: string;
  clientName: string;
  bookingNumber: string;
  consultantName: string;
  proposedDates: string[];
  adminMessage?: string;
}): Promise<void> {
  const html = await render(
    <ConsultationRescheduleEmail
      clientName={params.clientName}
      bookingNumber={params.bookingNumber}
      consultantName={params.consultantName}
      proposedDates={params.proposedDates}
      adminMessage={params.adminMessage}
    />,
  );
  await sendEmail({
    to: params.to,
    subject: `New Date Proposed — #${params.bookingNumber}`,
    html,
  });
}

export async function sendAdminConsultationNotification(params: {
  bookingNumber: string;
  clientName: string;
  clientEmail: string;
  consultantName: string;
  sessionTypeLabel: string;
  deliveryModeLabel: string;
  preferredDates: string[];
  isManual: boolean;
}): Promise<void> {
  const tag = params.isManual ? " [MANUAL REVIEW REQUIRED]" : "";
  const pref =
    params.preferredDates.length > 0
      ? `<p>Preferred dates: ${params.preferredDates.map((d) => new Date(d).toLocaleDateString("en-GB")).join(", ")}</p>`
      : "";
  const inner = `
    <p><strong>#${params.bookingNumber}</strong>${tag}</p>
    <p>Client: ${params.clientName} &lt;${params.clientEmail}&gt;</p>
    <p>Consultant: ${params.consultantName}</p>
    <p>${params.sessionTypeLabel} · ${params.deliveryModeLabel}</p>
    ${pref}
    <p><a href="${getPublicAppUrl()}/admin/consultations">Open admin</a></p>
  `;
  await sendAdminNotificationEmail(`New Consultation Booking — #${params.bookingNumber}${tag}`, inner);
}
