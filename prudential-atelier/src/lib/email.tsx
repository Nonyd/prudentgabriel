import { render } from "@react-email/render";
import React, { type ReactElement } from "react";
import WelcomeCredentialsEmail, {
  subjectWelcomeCredentials,
} from "@/emails/WelcomeCredentialsEmail";
import OrderConfirmationEmail from "@/emails/OrderConfirmationEmail";
import type { OrderItemLine } from "@/emails/OrderConfirmationEmail";
import OrderShippedEmail from "@/emails/OrderShippedEmail";
import BespokeConfirmationEmail from "@/emails/BespokeConfirmationEmail";
import PasswordResetEmail from "@/emails/PasswordResetEmail";
import AccountExistsEmail from "@/emails/AccountExistsEmail";
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
import PickupReadyEmail from "@/emails/PickupReadyEmail";
import ShippingQuoteEmail from "@/emails/ShippingQuoteEmail";
import BespokeDeliveredEmail, { subjectBespokeDelivered } from "@/emails/BespokeDeliveredEmail";
import ReceiptReminderEmail, { subjectReceiptReminder } from "@/emails/ReceiptReminderEmail";
import type { LoyaltyTier } from "@prisma/client";
import { getPublicAppUrl } from "@/lib/app-url";
import { primeEmailBranding, emailLogoWhiteUrl } from "@/lib/email-branding";
import { prisma } from "@/lib/prisma";
import { queueEmail } from "@/lib/email-outbox";
import { getSetting } from "@/lib/settings";
import { resolveAdminAlertEmail } from "@/lib/admin-alert-email";
import { UNSUBSCRIBE_URL_PLACEHOLDER } from "@/lib/email-priority";
import type { EmailFamily } from "@/emails/components/email-tokens";

async function renderBrandedEmail(element: ReactElement) {
  await primeEmailBranding();
  return render(element);
}

export async function getEmailLogo(): Promise<string | null> {
  const setting = await prisma.siteSetting.findUnique({ where: { key: "logo_dark" } });
  return setting?.value?.trim() || null;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  template: string;
  idempotencyKey: string;
  relatedType?: string;
  relatedId?: string;
  cc?: string;
  bcc?: string;
  fromAddress?: string;
  attachments?: import("@prisma/client").Prisma.InputJsonValue;
  priority?: number;
  headers?: Record<string, string>;
  defer?: boolean;
}): Promise<void> {
  await queueEmail(params);
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
  await sendEmail({ to, subject: welcomeSubject(firstName), html, template: "welcome", idempotencyKey: `welcome:${to}` });
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
    template: "welcome-credentials",
    idempotencyKey: `welcome-credentials:${params.email}:${params.sourceLabel}`,
    relatedType: "User",
    relatedId: params.email,
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
    template: "bank-transfer-receipt",
    idempotencyKey: `bank-receipt:${params.ref}`,
    relatedType: "Payment",
    relatedId: params.ref,
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
    template: "bank-transfer-admin",
    idempotencyKey: `bank-receipt-admin:${params.ref}`,
    relatedType: "Payment",
    relatedId: params.ref,
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
    template: "payment-confirmed",
    idempotencyKey: `payment-confirmed:${params.kind}:${params.ref}`,
    relatedType: "Payment",
    relatedId: params.ref,
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
    template: "payment-rejected",
    idempotencyKey: `payment-rejected:${params.ref}`,
    relatedType: "Payment",
    relatedId: params.ref,
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
  dduDisclosure?: string;
  quotePending?: boolean;
  quotePendingText?: string;
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
      dduDisclosure={params.dduDisclosure}
      quotePending={params.quotePending}
      quotePendingText={params.quotePendingText}
    />,
  );
  await sendEmail({
    to: params.to,
    subject: `Order Confirmed — #${params.orderNumber} | Prudential Atelier`,
    html,
    template: "order-confirmation",
    idempotencyKey: `order-confirmed:${params.orderNumber}`,
    relatedType: "Order",
    relatedId: params.orderNumber,
  });
}

export async function sendRtwFulfilmentRefusedEmails(params: {
  orderId: string;
  orderNumber: string;
  to: string;
  firstName: string;
  amountNGN: number;
}): Promise<void> {
  const amount = `₦${Math.round(params.amountNGN).toLocaleString("en-NG")}`;
  const contactUrl = `${getPublicAppUrl()}/contact`;

  await sendEmail({
    to: params.to,
    subject: `We could not fulfil order #${params.orderNumber} — refund underway`,
    html: wrapHtml(
      "Prudential Atelier",
      `<p>Dear ${escapeHtml(params.firstName)},</p>
       <p>Thank you for your order <strong>#${escapeHtml(params.orderNumber)}</strong>. Your payment of <strong>${amount}</strong> was received, but the piece sold out before we could reserve it.</p>
       <p>We will not ship a substitute. A refund of the full amount will be issued. If you have not seen it within a few working days, write to us at <a href="${escapeHtml(contactUrl)}">our contact page</a>.</p>
       <p>We are sorry — this should not happen, and we are treating it as such.</p>`,
    ),
    template: "rtw-fulfilment-refused",
    idempotencyKey: `rtw-fulfil-refused-customer:${params.orderId}`,
    relatedType: "Order",
    relatedId: params.orderId,
  });

  const adminTo = await resolveAdminAlertEmail(getSetting);
  if (adminTo.toLowerCase() !== params.to.toLowerCase()) {
    await sendEmail({
      to: adminTo,
      subject: `Refund required — RTW oversell #${params.orderNumber}`,
      html: wrapHtml(
        "Prudential Atelier",
        `<p>Order <strong>#${escapeHtml(params.orderNumber)}</strong> was paid (${amount}) but stock was insufficient at fulfilment.</p>
         <p>The order is cancelled. Refund ${escapeHtml(params.to)} in the PSP, then record the ledger correction (see PAYMENT_LEDGER.md — oversell / gap 7).</p>
         <p><a href="${escapeHtml(`${getPublicAppUrl()}/admin/orders/${params.orderId}`)}">Open the order</a>
         · <a href="${escapeHtml(`${getPublicAppUrl()}/admin/orders?attention=refund-required`)}">All paid · cancelled</a></p>`,
      ),
      template: "rtw-fulfilment-refused-admin",
      idempotencyKey: `rtw-fulfil-refused-admin:${params.orderId}`,
      relatedType: "Order",
      relatedId: params.orderId,
    });
  }
}

export async function sendPasswordResetEmail(to: string, resetUrl: string, tokenHash: string): Promise<void> {
  const html = await renderBrandedEmail(<PasswordResetEmail resetUrl={resetUrl} />);
  await sendEmail({
    to,
    subject: "Reset your Prudential Atelier password",
    html,
    template: "password-reset",
    idempotencyKey: `password-reset:${tokenHash}`,
    relatedType: "User",
    relatedId: to,
  });
}

export async function sendAccountExistsEmail(to: string, loginUrl: string): Promise<void> {
  const html = await renderBrandedEmail(<AccountExistsEmail loginUrl={loginUrl} />);
  await sendEmail({
    to,
    subject: "You already have a Prudential Atelier account",
    html,
    template: "account-exists",
    idempotencyKey: `account-exists:${to}`,
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
    template: "bespoke-confirmation",
    idempotencyKey: `bespoke-confirmation:${requestNumber}`,
    relatedType: "BespokeRequest",
    relatedId: requestNumber,
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
    ${htmlCta(href, "Pay now")}
    <p style="margin:16px 0 0;font-size:13px;color:#6B6B68;line-height:1.5;">
      If the button does not work, copy and paste this link into your browser:<br/>
      <span style="word-break:break-all;">${escapeHtml(params.payUrl)}</span>
    </p>
  `;
  await sendEmail({
    to: params.to,
    subject: `Complete payment — ${params.requestNumber} | Prudential Atelier`,
    html: wrapHtml("Prudential Atelier", inner),
    template: "bespoke-balance-link",
    idempotencyKey: `bespoke-balance-link:${params.requestNumber}`,
    relatedType: "BespokeOrder",
    relatedId: params.requestNumber,
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
    template: "referral-success",
    idempotencyKey: `referral-success:${to}:${friendFirstName}:${pointsEarned}`,
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
    template: "order-shipped",
    idempotencyKey: `order-shipped:${params.orderNumber}`,
    relatedType: "Order",
    relatedId: params.orderNumber,
  });
}

export async function sendPickupReadyEmail(params: {
  to: string;
  firstName: string;
  orderNumber: string;
  collectionCode: string;
  pickupName: string;
  address: string;
  hours: string;
  instructions?: string | null;
}): Promise<void> {
  const html = await renderBrandedEmail(
    <PickupReadyEmail
      firstName={params.firstName}
      orderNumber={params.orderNumber}
      collectionCode={params.collectionCode}
      pickupName={params.pickupName}
      address={params.address}
      hours={params.hours}
      instructions={params.instructions}
    />,
  );
  await sendEmail({
    to: params.to,
    subject: `Your piece is ready — #${params.orderNumber}`,
    html,
    template: "pickup-ready",
    idempotencyKey: `pickup-ready:${params.orderNumber}`,
    relatedType: "Order",
    relatedId: params.orderNumber,
  });
}

export async function sendUncollectedPickupEmail(params: {
  to: string;
  firstName: string;
  orderNumber: string;
  collectionCode: string;
  days: number;
}): Promise<void> {
  const html = wrapHtml(
    "Your piece is still waiting",
    `<p>Hi ${escapeHtml(params.firstName)},</p>
     <p>Order <strong>#${escapeHtml(params.orderNumber)}</strong> has been ready for collection for ${params.days} days.</p>
     <p>Your collection code is <strong>${escapeHtml(params.collectionCode)}</strong>.</p>
     <p>Please collect it soon, or write to us if you need a little more time.</p>`,
    "relationship",
  );
  await sendEmail({
    to: params.to,
    subject: `Still waiting for you — #${params.orderNumber}`,
    html,
    template: "uncollected-pickup",
    idempotencyKey: `uncollected-pickup:${params.orderNumber}`,
    relatedType: "Order",
    relatedId: params.orderNumber,
    priority: 0,
  });
}

export async function sendShippingQuoteEmail(params: {
  to: string;
  firstName: string;
  orderNumber: string;
  amountNGN: number;
  currency: string;
  paymentRef: string;
  bank: { bankName: string; accountNumber: string; accountName: string };
  payUrl: string;
}): Promise<void> {
  const amountLabel =
    params.currency === "USD"
      ? `$${params.amountNGN.toLocaleString("en-US")}`
      : `₦${Math.round(params.amountNGN).toLocaleString("en-NG")}`;
  const html = await renderBrandedEmail(
    <ShippingQuoteEmail
      firstName={params.firstName}
      orderNumber={params.orderNumber}
      amountLabel={amountLabel}
      paymentRef={params.paymentRef}
      bank={params.bank}
      payUrl={params.payUrl}
    />,
  );
  await sendEmail({
    to: params.to,
    subject: `Shipping for order #${params.orderNumber}`,
    html,
    template: "shipping-quote",
    idempotencyKey: `shipping-quote:${params.orderNumber}:${params.paymentRef}`,
    relatedType: "Order",
    relatedId: params.orderNumber,
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
    template: "rtw-delivered",
    idempotencyKey: `rtw-delivered:${params.orderNumber}`,
    relatedType: "Order",
    relatedId: params.orderNumber,
  });
}

export async function sendBespokeDeliveredEmail(params: {
  to: string;
  firstName: string;
  orderRef: string;
  confirmUrl: string;
  accountUrl: string;
}): Promise<void> {
  const html = await renderBrandedEmail(
    <BespokeDeliveredEmail
      firstName={params.firstName}
      orderRef={params.orderRef}
      confirmUrl={params.confirmUrl}
      accountUrl={params.accountUrl}
    />,
  );
  await sendEmail({
    to: params.to,
    subject: subjectBespokeDelivered(params.orderRef),
    html,
    template: "bespoke-delivered",
    idempotencyKey: `bespoke-delivered:${params.orderRef}`,
    relatedType: "BespokeOrder",
    relatedId: params.orderRef,
  });
}

export async function sendReceiptReminderEmail(params: {
  to: string;
  firstName: string;
  orderRef: string;
  confirmUrl: string;
}): Promise<void> {
  const html = await renderBrandedEmail(
    <ReceiptReminderEmail
      firstName={params.firstName}
      orderRef={params.orderRef}
      confirmUrl={params.confirmUrl}
    />,
  );
  await sendEmail({
    to: params.to,
    subject: subjectReceiptReminder(params.orderRef),
    html,
    template: "receipt-reminder",
    idempotencyKey: `receipt-reminder:${params.orderRef}`,
    relatedType: "BespokeOrder",
    relatedId: params.orderRef,
  });
}

export async function sendBespokeReviewRequestEmail(params: {
  to: string;
  firstName: string;
  orderRef: string;
  reviewUrl: string;
}): Promise<void> {
  const html = await renderBrandedEmail(
    <ReviewRequestEmail
      firstName={params.firstName}
      headline={`How was your commission ${params.orderRef}?`}
      bodyParagraph={`Your bespoke piece ${params.orderRef} is with you — we hope you love every detail. We'd be honoured to hear about your experience.`}
      ctaLabel="Share your thoughts"
      ctaUrl={params.reviewUrl}
    />,
  );
  await sendEmail({
    to: params.to,
    subject: `How was your commission ${params.orderRef}? — Prudential Atelier`,
    html,
    template: "bespoke-review-request",
    idempotencyKey: `bespoke-review:${params.orderRef}`,
    relatedType: "BespokeOrder",
    relatedId: params.orderRef,
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
    template: "loyalty-tier-upgrade",
    idempotencyKey: `loyalty-tier:${params.to}:${params.newTier}`,
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
    template: "referral-reward",
    idempotencyKey: `referral-reward:${params.to}:${params.creditNGN}`,
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
    template: "stage-assignment",
    idempotencyKey: `stage-assignment:${params.orderRef}:${params.stageName}:${params.to}`,
    relatedType: "BespokeOrder",
    relatedId: params.orderRef,
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
    template: "back-in-stock",
    idempotencyKey: `back-in-stock:${params.productSlug}:${params.size}:${params.to}`,
  });
}

function htmlCta(href: string, label: string): string {
  return `<table border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin:24px 0 8px;">
<tr><td bgcolor="#442913" style="background:#442913;">
<a href="${href}" style="display:inline-block;padding:14px 28px;background:#442913;color:#F7F2EC;font-family:Helvetica,Arial,sans-serif;font-size:12px;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;text-decoration:none;line-height:16px;">${label}</a>
</td></tr>
</table>`;
}

function wrapHtml(title: string, inner: string, family: EmailFamily = "transactional"): string {
  const logoBlock = emailLogoWhiteUrl
    ? `<img src="${emailLogoWhiteUrl}" alt="${title}" width="168" height="56" style="max-width:168px;height:auto;display:block;margin:0 auto;border:0;" />`
    : "";
  const pageBg = family === "marketing" ? "#E2D1C2" : "#F7F2EC";
  const cardBg = family === "marketing" ? "#F7F2EC" : "#FFFdf9";
  const pad =
    family === "transactional" ? "28px 36px 36px" : family === "relationship" ? "36px 40px 40px" : "24px 32px 36px";
  const goldBar =
    family === "transactional"
      ? `<tr><td height="3" bgcolor="#C9A84C" style="background:#C9A84C;font-size:0;line-height:0;height:3px;">&nbsp;</td></tr>`
      : "";
  const headerHairline =
    family === "relationship"
      ? `<table border="0" cellpadding="0" cellspacing="0" role="presentation" align="center" style="margin:16px auto 0;"><tr><td height="1" width="48" bgcolor="#C9A84C" style="background:#C9A84C;font-size:0;line-height:0;">&nbsp;</td></tr></table>`
      : "";
  const footerNote =
    family === "marketing"
      ? `<p style="margin:14px 0 0;font-size:11px;line-height:18px;color:#6B5E52;">You received this because you subscribed or have shopped with the house.<br/><a href="${UNSUBSCRIBE_URL_PLACEHOLDER}" style="color:#C9A84C;text-decoration:underline;">Unsubscribe</a></p>`
      : `<p style="margin:14px 0 0;font-size:10px;">This message is about an order or account. It is not marketing mail.</p>`;
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="color-scheme" content="light dark"/>
<meta name="supported-color-schemes" content="light dark"/>
</head>
<body style="margin:0;padding:0;background:${pageBg};font-family:Georgia,'Times New Roman',Times,serif;color:#2C241C;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${pageBg};">
<tr><td align="center" style="padding:24px 12px;">
<table width="600" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;max-width:600px;background:${cardBg};">
<tr><td bgcolor="#442913" style="background:#442913;padding:24px;text-align:center;">
${logoBlock}
<p style="margin:${logoBlock ? "14px 0 0" : "0"};font-size:11px;letter-spacing:0.28em;text-transform:uppercase;color:#C9A84C;font-family:Georgia,'Times New Roman',Times,serif;">Prudential Atelier</p>
${headerHairline}
</td></tr>
${goldBar}
<tr><td style="padding:${pad};">${inner}</td></tr>
<tr><td bgcolor="#1A0F08" style="background:#1A0F08;padding:28px 36px;text-align:center;color:rgba(226,209,194,0.62);font-size:11px;font-family:Helvetica,Arial,sans-serif;">
<p style="margin:0 0 8px;font-family:Georgia,serif;">Prudential Atelier</p>
<p style="margin:0 0 6px;">14 Bode Thomas Street, Surulere, Lagos, Nigeria</p>
<p style="margin:0;">hello@prudentgabriel.com</p>
${footerNote}
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

export async function sendAbandonedCartEmail(params: {
  to: string;
  firstName: string;
  lines: { name: string; quantity: number }[];
  checkoutUrl: string;
  idempotencyKey: string;
  userId: string;
}): Promise<{ created: boolean }> {
  await primeEmailBranding();
  const href = params.checkoutUrl.replace(/"/g, "%22");
  const list = params.lines
    .map(
      (l) =>
        `<li style="margin:0 0 6px;font-size:15px;line-height:1.5;">${escapeHtml(l.name)} × ${l.quantity}</li>`,
    )
    .join("");
  const inner = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">Dear ${escapeHtml(params.firstName)},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      You left a few pieces in your bag. They are still waiting for you.
    </p>
    <ul style="margin:0 0 16px;padding-left:18px;">${list}</ul>
    ${htmlCta(href, "Return to checkout")}
  `;
  const queued = await queueEmail({
    to: params.to,
    subject: "Your bag is waiting | Prudential Atelier",
    html: wrapHtml("Prudential Atelier", inner, "marketing"),
    template: "abandoned-cart",
    idempotencyKey: params.idempotencyKey,
    relatedType: "User",
    relatedId: params.userId,
  });
  return { created: queued.created };
}

export async function sendStageApprovalRequestEmail(params: {
  to: string;
  clientName: string;
  orderRef: string;
  stageLabel: string;
  notes: string | null;
  imageUrls: string[];
  approveUrl: string;
}): Promise<void> {
  await primeEmailBranding();
  const href = params.approveUrl.replace(/"/g, "%22");
  const first = params.clientName.split(/\s+/)[0] ?? params.clientName;
  const notes = params.notes?.trim()
    ? `<p style="margin:16px 0;font-size:15px;line-height:1.5;white-space:pre-wrap;">${escapeHtml(params.notes.trim())}</p>`
    : "";
  const images = params.imageUrls
    .slice(0, 6)
    .map(
      (url) =>
        `<img src="${escapeHtml(url)}" alt="" width="160" style="max-width:160px;height:auto;margin:4px;border:1px solid #E2D1C2;" />`,
    )
    .join("");
  const inner = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">Dear ${escapeHtml(first)},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      ${escapeHtml(params.stageLabel)} on order <strong>${escapeHtml(params.orderRef)}</strong> is ready for your review.
    </p>
    ${notes}
    ${images ? `<div style="margin:16px 0;">${images}</div>` : ""}
    ${htmlCta(href, "Review &amp; approve")}
  `;
  await sendEmail({
    to: params.to,
    subject: `Please review ${params.stageLabel} — ${params.orderRef} | Prudential Atelier`,
    html: wrapHtml("Prudential Atelier", inner, "relationship"),
    template: "stage-approval-request",
    idempotencyKey: `stage-approval:${params.orderRef}:${params.stageLabel}`,
    relatedType: "BespokeOrder",
    relatedId: params.orderRef,
  });
}

export async function sendStageApprovalReminderEmail(params: {
  to: string;
  clientName: string;
  orderRef: string;
  stageLabel: string;
  approveUrl: string;
}): Promise<void> {
  await primeEmailBranding();
  const href = params.approveUrl.replace(/"/g, "%22");
  const first = params.clientName.split(/\s+/)[0] ?? params.clientName;
  const inner = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">Dear ${escapeHtml(first)},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      A reminder: ${escapeHtml(params.stageLabel)} on order <strong>${escapeHtml(params.orderRef)}</strong>
      is still waiting for your approval.
    </p>
    ${htmlCta(href, "Review now")}
  `;
  await sendEmail({
    to: params.to,
    subject: `Reminder: review ${params.stageLabel} — ${params.orderRef}`,
    html: wrapHtml("Prudential Atelier", inner, "relationship"),
    template: "stage-approval-reminder",
    idempotencyKey: `stage-approval-reminder:${params.orderRef}:${params.stageLabel}`,
    relatedType: "BespokeOrder",
    relatedId: params.orderRef,
  });
}

export async function sendStageChangesRequestedEmail(params: {
  to: string;
  staffName: string;
  orderRef: string;
  stageLabel: string;
  comment: string;
  orderUrl: string;
}): Promise<void> {
  await primeEmailBranding();
  const href = params.orderUrl.replace(/"/g, "%22");
  const inner = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">Hi ${escapeHtml(params.staffName)},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      The client requested changes on <strong>${escapeHtml(params.orderRef)}</strong>
      (${escapeHtml(params.stageLabel)}).
    </p>
    <p style="margin:16px 0;font-size:15px;line-height:1.5;white-space:pre-wrap;">${escapeHtml(params.comment)}</p>
    ${htmlCta(href, "Open order")}
  `;
  await sendEmail({
    to: params.to,
    subject: `Changes requested — ${params.orderRef} / ${params.stageLabel}`,
    html: wrapHtml("Prudential Atelier", inner),
    template: "stage-changes-requested",
    idempotencyKey: `stage-changes:${params.orderRef}:${params.stageLabel}`,
    relatedType: "BespokeOrder",
    relatedId: params.orderRef,
  });
}

export async function sendAdminNotificationEmail(
  subject: string,
  htmlInner: string,
  idempotencyKey?: string,
): Promise<void> {
  const admin = process.env.ADMIN_EMAIL;
  if (!admin) {
    console.log("[EMAIL admin]", subject);
    return;
  }
  await primeEmailBranding();
  await sendEmail({
    to: admin,
    subject,
    html: wrapHtml("Admin", htmlInner),
    template: "admin-notification",
    idempotencyKey: idempotencyKey ?? `admin-notify:${subject}`,
  });
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
    template: "consultation-pending",
    idempotencyKey: `consultation-pending:${params.bookingNumber}`,
    relatedType: "ConsultationBooking",
    relatedId: params.bookingNumber,
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
    template: "consultation-confirmed",
    idempotencyKey: `consultation-confirmed:${params.bookingNumber}`,
    relatedType: "ConsultationBooking",
    relatedId: params.bookingNumber,
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
    template: "consultation-cancelled",
    idempotencyKey: `consultation-cancelled:${params.bookingNumber}`,
    relatedType: "ConsultationBooking",
    relatedId: params.bookingNumber,
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
    template: "consultation-session-summary",
    idempotencyKey: `consultation-summary:${params.to}:${params.moodboardUrl ?? "none"}`,
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
    template: "consultation-meeting-link",
    idempotencyKey: `consultation-meeting-link:${params.to}:${params.meetingLink}`,
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
    template: "consultation-reschedule",
    idempotencyKey: `consultation-reschedule:${params.bookingNumber}`,
    relatedType: "ConsultationBooking",
    relatedId: params.bookingNumber,
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
    template: "invoice",
    idempotencyKey: `invoice:${params.invoiceNumber}`,
    relatedType: "Invoice",
    relatedId: params.invoiceNumber,
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
  await sendAdminNotificationEmail(
    `New Consultation Booking — #${params.bookingNumber}${tag}`,
    inner,
    `consultation-admin:${params.bookingNumber}`,
  );
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
    template: "product-review-request",
    idempotencyKey: `product-review:${params.orderId}:${params.productId}`,
    relatedType: "Order",
    relatedId: params.orderId,
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
    template: "consultation-review-request",
    idempotencyKey: `consultation-review:${params.consultationId}`,
    relatedType: "ConsultationBooking",
    relatedId: params.consultationId,
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
    template: "job-application-confirmation",
    idempotencyKey: `job-application-confirm:${params.applicationId}`,
    relatedType: "JobApplication",
    relatedId: params.applicationId,
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
    `job-application-admin:${params.applicationId}`,
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
    template: "job-application-status",
    idempotencyKey: `job-application-status:${params.to}:${params.jobTitle}:${params.status}`,
  });
}
