import { render } from "@react-email/render";
import type { ReactElement } from "react";
import { Resend } from "resend";
import WelcomeCredentialsEmail, {
  subjectWelcomeCredentials,
} from "@/emails/WelcomeCredentialsEmail";
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
import ConsultationMeetingLinkEmail from "@/emails/ConsultationMeetingLinkEmail";
import ConsultationSessionSummaryEmail from "@/emails/ConsultationSessionSummaryEmail";
import InvoiceEmail, { subjectInvoiceEmail } from "@/emails/InvoiceEmail";
import ReviewRequestEmail from "@/emails/ReviewRequestEmail";
import LoyaltyTierUpgradeEmail from "@/emails/LoyaltyTierUpgradeEmail";
import ReferralRewardEmail from "@/emails/ReferralRewardEmail";
import StageAssignmentEmail from "@/emails/StageAssignmentEmail";
import RtwOrderDeliveredEmail from "@/emails/RtwOrderDeliveredEmail";
import type { LoyaltyTier } from "@prisma/client";
import { getPublicAppUrl } from "@/lib/app-url";
import { primeEmailBranding, emailLogoWhiteUrl } from "@/lib/email-branding";
import { sendSmtpMail, EMAIL_FROM } from "@/lib/email-transport";
import { prisma } from "@/lib/prisma";
const FROM = EMAIL_FROM;

async function renderBrandedEmail(element: ReactElement) {
  await primeEmailBranding();
  return render(element);
}

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export async function getEmailLogo(): Promise<string | null> {
  const setting = await prisma.siteSetting.findUnique({ where: { key: "logo_dark" } });
  return setting?.value?.trim() || null;
}

export async function sendEmail(params: { to: string; subject: string; html: string }): Promise<void> {
  if (process.env.SMTP_PASSWORD) {
    try {
      await sendSmtpMail({ to: params.to, subject: params.subject, html: params.html, from: FROM });
      return;
    } catch (e) {
      console.warn("[EMAIL] SMTP send failed, trying Resend", e);
    }
  }

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
  const WelcomeEmail = (await import("@/emails/WelcomeEmail")).default;
  const { subject: welcomeSubject } = await import("@/emails/WelcomeEmail");
  const html = await renderBrandedEmail(
    <WelcomeEmail firstName={firstName} pointsBalance={pointsBalance} referralCode={referralCode} />,
  );
  await sendEmail({ to, subject: welcomeSubject(firstName), html });
}

export async function sendWelcomeCredentialsEmail(params: {
  to: string;
  firstName: string;
  email: string;
  tempPassword: string;
  sourceLabel: string;
  trackUrl: string;
}): Promise<void> {
  const loginUrl = `${getPublicAppUrl()}/login`;
  const html = await renderBrandedEmail(
    <WelcomeCredentialsEmail
      firstName={params.firstName}
      email={params.email}
      tempPassword={params.tempPassword}
      sourceLabel={params.sourceLabel}
      trackUrl={params.trackUrl}
      loginUrl={loginUrl}
    />,
  );
  await sendEmail({
    to: params.to,
    subject: subjectWelcomeCredentials(params.firstName),
    html,
  });
}

export async function sendBankTransferReceiptReceivedEmail(params: {
  to: string;
  clientName: string;
  ref: string;
  amountNGN: number;
}): Promise<void> {
  await sendEmail({
    to: params.to,
    subject: `Payment receipt received — ${params.ref}`,
    html: wrapHtml(
      "Prudential Atelier",
      `<p>Dear ${escapeHtml(params.clientName)},</p>
       <p>We received your bank transfer receipt for <strong>₦${params.amountNGN.toLocaleString("en-NG")}</strong> (${escapeHtml(params.ref)}).</p>
       <p>Our team will verify within 2–4 hours and confirm your order by email.</p>`,
    ),
  });
}

export async function sendBankTransferAdminNotification(params: {
  ref: string;
  clientName: string;
  amountNGN: number;
  receiptUrl: string;
}): Promise<void> {
  const adminEmail = process.env.ORDERS_ADMIN_EMAIL ?? "orders@prudentgabriel.com";
  await sendEmail({
    to: adminEmail,
    subject: `[Bank transfer pending] ${params.ref}`,
    html: wrapHtml(
      "Prudential Atelier Admin",
      `<p>New bank transfer receipt submitted.</p>
       <p><strong>Ref:</strong> ${escapeHtml(params.ref)}<br/>
       <strong>Client:</strong> ${escapeHtml(params.clientName)}<br/>
       <strong>Amount:</strong> ₦${params.amountNGN.toLocaleString("en-NG")}</p>
       <p><a href="${escapeHtml(params.receiptUrl)}">View receipt</a></p>`,
    ),
  });
}

export async function sendPaymentConfirmedEmail(params: {
  to: string;
  ref: string;
  amountNGN: number;
  kind: "order" | "consultation" | "bespoke";
  trackUrl: string;
}): Promise<void> {
  const kindLabel =
    params.kind === "consultation" ? "consultation" : params.kind === "bespoke" ? "atelier order" : "order";
  await sendEmail({
    to: params.to,
    subject: `Payment confirmed — ${params.ref}`,
    html: wrapHtml(
      "Prudential Atelier",
      `<p>We&apos;ve confirmed your payment of <strong>₦${params.amountNGN.toLocaleString("en-NG")}</strong>.</p>
       <p>Your ${kindLabel} is now active.</p>
       <p><a href="${escapeHtml(params.trackUrl)}">Track your order</a></p>`,
    ),
  });
}

export async function sendPaymentRejectedEmail(params: {
  to: string;
  ref: string;
  amountNGN: number;
  reason: string;
}): Promise<void> {
  await sendEmail({
    to: params.to,
    subject: "Payment not confirmed — action needed",
    html: wrapHtml(
      "Prudential Atelier",
      `<p>Unfortunately we couldn&apos;t confirm your payment of <strong>₦${params.amountNGN.toLocaleString("en-NG")}</strong>.</p>
       <p><strong>Reason:</strong> ${escapeHtml(params.reason)}</p>
       <p>Please contact us or try again.</p>
       <p><a href="${getPublicAppUrl()}/contact">Contact us</a></p>`,
    ),
  });
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
  const html = await renderBrandedEmail(
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
  const html = await renderBrandedEmail(<PasswordResetEmail resetUrl={resetUrl} />);
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
  const html = await renderBrandedEmail(
    <BespokeConfirmationEmail name={name} requestNumber={requestNumber} occasion={occasion} timeline={timeline} />,
  );
  await sendEmail({
    to,
    subject: `Atelier Request Received — ${requestNumber}`,
    html,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Email sent when an admin creates a manual bespoke order and generates a Paystack balance link. */
export async function sendBespokeBalancePaymentLinkEmail(params: {
  to: string;
  clientName: string;
  requestNumber: string;
  amountNGN: number;
  payUrl: string;
}): Promise<void> {
  await primeEmailBranding();
  const href = params.payUrl.replace(/"/g, "%22");
  const inner = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">Dear ${escapeHtml(params.clientName)},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      Your atelier order <strong>${escapeHtml(params.requestNumber)}</strong> is ready for payment.
      Please complete the secure checkout for the outstanding balance of
      <strong>₦${params.amountNGN.toLocaleString("en-NG")}</strong>.
    </p>
    <p style="margin:24px 0;">
      <a href="${href}" style="display:inline-block;background:#37392d;color:#fff;padding:14px 28px;text-decoration:none;font-size:14px;">
        Pay now
      </a>
    </p>
    <p style="margin:16px 0 0;font-size:13px;color:#6B6B68;line-height:1.5;">
      If the button does not work, copy and paste this link into your browser:<br/>
      <span style="word-break:break-all;">${escapeHtml(params.payUrl)}</span>
    </p>
  `;
  await sendEmail({
    to: params.to,
    subject: `Complete payment — ${params.requestNumber} | Prudential Atelier`,
    html: wrapHtml("Prudential Atelier", inner),
  });
}

export async function sendReferralSuccessEmail(
  to: string,
  referrerName: string,
  friendFirstName: string,
  pointsEarned: number,
  newBalance: number,
): Promise<void> {
  const html = await renderBrandedEmail(
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
  const html = await renderBrandedEmail(
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

export async function sendRtwOrderDeliveredEmail(params: {
  to: string;
  firstName: string;
  orderNumber: string;
}): Promise<void> {
  const html = await renderBrandedEmail(
    <RtwOrderDeliveredEmail firstName={params.firstName} orderNumber={params.orderNumber} />,
  );
  await sendEmail({
    to: params.to,
    subject: `Your order has been delivered — #${params.orderNumber}`,
    html,
  });
}

export async function sendLoyaltyTierUpgradeEmail(params: {
  to: string;
  firstName: string;
  newTier: LoyaltyTier;
  perks: string[];
}): Promise<void> {
  const html = await renderBrandedEmail(
    <LoyaltyTierUpgradeEmail firstName={params.firstName} newTier={params.newTier} perks={params.perks} />,
  );
  await sendEmail({
    to: params.to,
    subject: `You've reached a new loyalty tier — Prudential Atelier`,
    html,
  });
}

export async function sendReferralRewardEmail(params: {
  to: string;
  firstName: string;
  creditNGN: number;
}): Promise<void> {
  const html = await renderBrandedEmail(
    <ReferralRewardEmail firstName={params.firstName} creditNGN={params.creditNGN} />,
  );
  await sendEmail({
    to: params.to,
    subject: "You've earned a referral reward — Prudential Atelier",
    html,
  });
}

export async function sendStageAssignmentEmail(params: {
  to: string;
  firstName: string;
  stageName: string;
  orderRef: string;
  outfitName: string;
  deliveryDate?: string;
}): Promise<void> {
  const html = await renderBrandedEmail(
    <StageAssignmentEmail
      firstName={params.firstName}
      stageName={params.stageName}
      orderRef={params.orderRef}
      outfitName={params.outfitName}
      deliveryDate={params.deliveryDate}
    />,
  );
  await sendEmail({
    to: params.to,
    subject: `New assignment — ${params.orderRef}`,
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
  const html = await renderBrandedEmail(
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
  const logoBlock = emailLogoWhiteUrl
    ? `<img src="${emailLogoWhiteUrl}" alt="${title}" width="160" style="max-width:160px;height:auto;display:block;margin:0 auto;" />`
    : `<span style="color:#C9A84C;font-size:18px;">${title}</span>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="margin:0;background:#FAF6EF;font-family:Georgia,serif;color:#2d2d2d;">
<div style="background:#442913;padding:20px;text-align:center;">
  ${logoBlock}
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
  await primeEmailBranding();
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
  const html = await renderBrandedEmail(
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
  const html = await renderBrandedEmail(
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
  const html = await renderBrandedEmail(
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

export async function sendConsultationSessionSummaryEmail(params: {
  to: string;
  firstName: string;
  sessionNotes?: string;
  moodboardImages?: string[];
  moodboardUrl?: string;
  commissionUrl?: string;
  showCommissionCta?: boolean;
}): Promise<void> {
  const html = await renderBrandedEmail(
    <ConsultationSessionSummaryEmail
      firstName={params.firstName}
      sessionNotes={params.sessionNotes}
      moodboardImages={params.moodboardImages}
      moodboardUrl={params.moodboardUrl}
      commissionUrl={params.commissionUrl}
      showCommissionCta={params.showCommissionCta}
    />,
  );
  await sendEmail({
    to: params.to,
    subject: "Thank you for your consultation — Prudential Atelier",
    html,
  });
}

export async function sendConsultationMeetingLinkEmail(params: {
  to: string;
  clientName: string;
  platformLabel: string;
  confirmedDate: string;
  confirmedTime: string;
  meetingLink: string;
  isWhatsApp: boolean;
}): Promise<void> {
  const html = await renderBrandedEmail(
    <ConsultationMeetingLinkEmail
      clientName={params.clientName}
      platformLabel={params.platformLabel}
      confirmedDate={params.confirmedDate}
      confirmedTime={params.confirmedTime}
      meetingLink={params.meetingLink}
      isWhatsApp={params.isWhatsApp}
    />,
  );
  await sendEmail({
    to: params.to,
    subject: "Your consultation link — Prudential Atelier",
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
  const html = await renderBrandedEmail(
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

export async function sendInvoiceEmail(params: {
  to: string;
  clientName: string;
  invoiceNumber: string;
  total: string;
  currency: string;
  dueDate?: string;
  depositRequired?: string;
  publicLink: string;
  clientNote?: string;
  footerNote?: string;
  businessName?: string;
}): Promise<void> {
  const businessName = params.businessName ?? "Prudential Atelier";
  const props = {
    invoiceNumber: params.invoiceNumber,
    clientName: params.clientName,
    businessName,
    total: params.total,
    currency: params.currency,
    dueDate: params.dueDate,
    depositRequired: params.depositRequired,
    publicLink: params.publicLink,
    clientNote: params.clientNote,
    footerNote: params.footerNote,
  };
  const html = await renderBrandedEmail(<InvoiceEmail {...props} />);
  await sendEmail({
    to: params.to,
    subject: subjectInvoiceEmail(props),
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

export async function sendProductReviewRequestEmail(params: {
  to: string;
  firstName: string;
  productName: string;
  productId: string;
  orderId: string;
}): Promise<void> {
  const appUrl = getPublicAppUrl();
  const reviewUrl = `${appUrl}/account/reviews/new?product=${params.productId}&order=${params.orderId}`;
  const html = await renderBrandedEmail(
    <ReviewRequestEmail
      firstName={params.firstName}
      headline={`How was your ${params.productName}?`}
      bodyParagraph={`Your ${params.productName} has been delivered — we hope you love it as much as we loved creating it. We'd be honoured to hear about your experience.`}
      ctaLabel="Share your review"
      ctaUrl={reviewUrl}
    />,
  );
  await sendEmail({
    to: params.to,
    subject: `How was your ${params.productName}? — Prudential Atelier`,
    html,
  });
}

export async function sendConsultationReviewRequestEmail(params: {
  to: string;
  firstName: string;
  consultationId: string;
}): Promise<void> {
  const appUrl = getPublicAppUrl();
  const reviewUrl = `${appUrl}/account/reviews/new?consultation=${params.consultationId}`;
  const html = await renderBrandedEmail(
    <ReviewRequestEmail
      firstName={params.firstName}
      headline="How was your consultation?"
      bodyParagraph="Thank you for sitting with us. It was a pleasure getting to know your vision. We'd love to hear how your experience was — it helps us serve you and every client better."
      ctaLabel="Share your experience"
      ctaUrl={reviewUrl}
    />,
  );
  await sendEmail({
    to: params.to,
    subject: "How was your consultation? — Prudential Atelier",
    html,
  });
}

export async function sendJobApplicationConfirmationEmail(params: {
  to: string;
  name: string;
  jobTitle: string;
  applicationId: string;
}): Promise<void> {
  const JobApplicationConfirmationEmail = (await import("@/emails/JobApplicationConfirmationEmail"))
    .JobApplicationConfirmationEmail;
  const html = await renderBrandedEmail(
    <JobApplicationConfirmationEmail
      name={params.name}
      jobTitle={params.jobTitle}
      applicationId={params.applicationId}
    />,
  );
  await sendEmail({
    to: params.to,
    subject: `Application received — ${params.jobTitle} at Prudential Atelier`,
    html,
  });
}

export async function sendJobApplicationAdminEmail(params: {
  jobTitle: string;
  name: string;
  email: string;
  phone: string;
  yearsOfExp: number | null;
  applicationId: string;
}): Promise<void> {
  const appUrl = getPublicAppUrl();
  const reviewUrl = `${appUrl}/admin/careers/applications/${params.applicationId}`;
  const exp = params.yearsOfExp != null ? `${params.yearsOfExp} years` : "Not specified";
  await sendAdminNotificationEmail(
    `New application: ${params.jobTitle} — ${params.name}`,
    `
      <p><strong>New job application received.</strong></p>
      <p><strong>Position:</strong> ${params.jobTitle}</p>
      <p><strong>Applicant:</strong> ${params.name}</p>
      <p><strong>Email:</strong> ${params.email}</p>
      <p><strong>Phone:</strong> ${params.phone}</p>
      <p><strong>Experience:</strong> ${exp}</p>
      <p><a href="${reviewUrl}">Review application</a></p>
    `,
  );
}

export async function sendJobApplicationStatusEmail(params: {
  to: string;
  name: string;
  jobTitle: string;
  status: import("@prisma/client").ApplicationStatus;
}): Promise<void> {
  const { JobApplicationStatusEmail, jobStatusEmailCopy } = await import(
    "@/emails/JobApplicationStatusEmail"
  );
  const copy = jobStatusEmailCopy(params.status);
  if (!copy) return;
  const html = await renderBrandedEmail(
    <JobApplicationStatusEmail name={params.name} jobTitle={params.jobTitle} status={params.status} />,
  );
  await sendEmail({
    to: params.to,
    subject: `${copy.subject} — ${params.jobTitle}`,
    html,
  });
}
