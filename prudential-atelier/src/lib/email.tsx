import { render } from "@react-email/render";
import React, { type ReactElement } from "react";
import WelcomeCredentialsEmail from "@/emails/WelcomeCredentialsEmail";
import OrderConfirmationEmail from "@/emails/OrderConfirmationEmail";
import type { OrderItemLine } from "@/emails/OrderConfirmationEmail";
import OrderShippedEmail from "@/emails/OrderShippedEmail";
import OrderProductionStartedEmail from "@/emails/OrderProductionStartedEmail";
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
import InvoiceEmail from "@/emails/InvoiceEmail";
import ReviewRequestEmail from "@/emails/ReviewRequestEmail";
import LoyaltyTierUpgradeEmail from "@/emails/LoyaltyTierUpgradeEmail";
import PointsExpiryEmail from "@/emails/PointsExpiryEmail";
import ReferralRewardEmail from "@/emails/ReferralRewardEmail";
import StageAssignmentEmail from "@/emails/StageAssignmentEmail";
import RtwOrderDeliveredEmail from "@/emails/RtwOrderDeliveredEmail";
import PickupReadyEmail from "@/emails/PickupReadyEmail";
import ShippingQuoteEmail from "@/emails/ShippingQuoteEmail";
import BespokeDeliveredEmail from "@/emails/BespokeDeliveredEmail";
import ReceiptReminderEmail from "@/emails/ReceiptReminderEmail";
import type { LoyaltyTier } from "@prisma/client";
import { getPublicAppUrl, absolutePublicUrl } from "@/lib/app-url";
import { emailSafeReceiptUrl } from "@/lib/media/receipt-src";
import { CUSTOMER_HOUSE_NAME, EMAIL_LOGO_PX, customerLoginUrl } from "@/lib/customer-email";
import { HOUSE_ADDRESS_ONE_LINE, resolvePickupAddress, resolvePickupName } from "@/lib/house-address";
import { catalogCopy, sendUsingCatalog } from "@/lib/catalog-email";
import { EMAIL_TEMPLATE_KEYS } from "@/lib/admin-email-catalog";
import { primeEmailBranding, emailLogoWhiteUrl, emailHouseAddress } from "@/lib/email-branding";
import { prisma } from "@/lib/prisma";
import { queueEmail } from "@/lib/email-outbox";
import { logError } from "@/lib/logger";
import { getSetting } from "@/lib/settings";
import { resolveAdminAlertEmail, resolveHrAlertEmail } from "@/lib/admin-alert-email";
import { UNSUBSCRIBE_URL_PLACEHOLDER, EMAIL_PRIORITY_MARKETING } from "@/lib/email-priority";
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
  try {
    await queueEmail(params);
  } catch (error) {
    await logError({
      severity: "WARNING",
      errorType: "EMAIL_QUEUE",
      message: `${params.template}: ${error instanceof Error ? error.message : "queue failed"}`,
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

export async function sendWelcomeEmail(
  to: string,
  firstName: string,
  pointsBalance: number,
  referralCode: string,
): Promise<void> {
  const WelcomeEmail = (await import("@/emails/WelcomeEmail")).default;
  const copy = await catalogCopy(EMAIL_TEMPLATE_KEYS.WELCOME, { firstName });
  const html = await renderBrandedEmail(
    <WelcomeEmail firstName={firstName} pointsBalance={pointsBalance} referralCode={referralCode} />,
  );
  await sendEmail({ to, subject: copy.subject, html, template: "welcome", idempotencyKey: `welcome:${to}` });
}

export async function sendWelcomeCredentialsEmail(params: {
  to: string;
  firstName: string;
  email: string;
  tempPassword: string;
  sourceLabel: string;
  trackUrl: string;
}): Promise<void> {
  const loginUrl = customerLoginUrl();
  const copy = await catalogCopy(EMAIL_TEMPLATE_KEYS.WELCOME_CREDENTIALS, {
    firstName: params.firstName,
    email: params.email,
  });
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
    subject: copy.subject,
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
  const firstName = params.clientName.split(/\s+/)[0] ?? params.clientName;
  await sendUsingCatalog({
    key: EMAIL_TEMPLATE_KEYS.BANK_TRANSFER_RECEIVED,
    to: params.to,
    vars: {
      firstName,
      orderRef: params.ref,
      amount: `₦${params.amountNGN.toLocaleString("en-NG")}`,
    },
    outboxTemplate: "bank-transfer-receipt",
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
  adminPath?: string;
}): Promise<void> {
  const adminEmail = await resolveAdminAlertEmail(getSetting);
  if (!adminEmail) {
    console.log("[EMAIL bank-transfer-admin] no operational mailbox configured");
    return;
  }
  const receiptHref = emailSafeReceiptUrl(params.receiptUrl);
  const adminHref = params.adminPath ? absolutePublicUrl(params.adminPath) : "";
  const adminLink = adminHref
    ? ` · <a href="${escapeHtml(adminHref)}">Open in admin</a>`
    : "";
  await sendUsingCatalog({
    key: EMAIL_TEMPLATE_KEYS.BANK_TRANSFER_ADMIN,
    to: adminEmail,
    vars: {
      firstName: params.clientName,
      orderRef: params.ref,
      amount: `₦${params.amountNGN.toLocaleString("en-NG")}`,
      link: adminHref || receiptHref,
    },
    extraHtml: `<p><a href="${escapeHtml(receiptHref)}">View receipt</a>${adminLink}</p>`,
    outboxTemplate: "bank-transfer-admin",
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
  await sendUsingCatalog({
    key: EMAIL_TEMPLATE_KEYS.PAYMENT_CONFIRMED,
    to: params.to,
    vars: {
      firstName: "there",
      orderRef: params.ref,
      amount: `₦${params.amountNGN.toLocaleString("en-NG")}`,
      link: params.trackUrl,
    },
    outboxTemplate: "payment-confirmed",
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
  await sendUsingCatalog({
    key: EMAIL_TEMPLATE_KEYS.PAYMENT_REJECTED,
    to: params.to,
    vars: {
      firstName: "there",
      orderRef: params.ref,
      amount: `₦${params.amountNGN.toLocaleString("en-NG")}`,
    },
    extraHtml: `<p><strong>Reason:</strong> ${escapeHtml(params.reason)}</p>`,
    outboxTemplate: "payment-rejected",
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
  pointsEarned?: number;
  subtotalNGN?: number;
  addressSnapshot?: Record<string, string>;
  estimatedDays?: string;
  dduDisclosure?: string;
  quotePending?: boolean;
  quotePendingText?: string;
  customLeadDays?: number | null;
  customReturnNote?: string | null;
}): Promise<void> {
  const subtotal =
    params.subtotalNGN ??
    params.items.reduce((s, i) => s + i.priceNGN * i.qty, 0);
  const copy = await catalogCopy(EMAIL_TEMPLATE_KEYS.RTW_ORDER_CONFIRMED, {
    firstName: params.firstName,
    orderRef: params.orderNumber,
    amount: `₦${Math.round(params.totalNGN).toLocaleString("en-NG")}`,
    link: `${getPublicAppUrl()}/account/orders`,
  });
  const html = await renderBrandedEmail(
    <OrderConfirmationEmail
      firstName={params.firstName}
      orderNumber={params.orderNumber}
      items={params.items}
      subtotalNGN={subtotal}
      shippingNGN={params.shippingNGN}
      discountNGN={params.discountNGN}
      pointsDiscNGN={params.pointsDiscNGN}
      pointsEarned={params.pointsEarned ?? 0}
      totalNGN={params.totalNGN}
      addressSnapshot={params.addressSnapshot}
      estimatedDays={params.estimatedDays}
      dduDisclosure={params.dduDisclosure}
      quotePending={params.quotePending}
      quotePendingText={params.quotePendingText}
      customLeadDays={params.customLeadDays}
      customReturnNote={params.customReturnNote}
      catalogHeading={copy.heading}
      catalogBody={copy.body1}
      catalogCtaLabel={copy.ctaLabel}
      catalogCtaHref={copy.ctaLink}
    />,
  );
  await sendEmail({
    to: params.to,
    subject: copy.subject,
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

  await sendUsingCatalog({
    key: EMAIL_TEMPLATE_KEYS.RTW_FULFILMENT_REFUSED,
    to: params.to,
    vars: {
      firstName: params.firstName,
      orderRef: params.orderNumber,
      amount,
    },
    outboxTemplate: "rtw-fulfilment-refused",
    idempotencyKey: `rtw-fulfil-refused-customer:${params.orderId}`,
    relatedType: "Order",
    relatedId: params.orderId,
  });

  const adminTo = await resolveAdminAlertEmail(getSetting);
  if (adminTo && adminTo.toLowerCase() !== params.to.toLowerCase()) {
    await sendUsingCatalog({
      key: EMAIL_TEMPLATE_KEYS.RTW_FULFILMENT_REFUSED_ADMIN,
      to: adminTo,
      vars: {
        firstName: params.firstName,
        orderRef: params.orderNumber,
        amount,
        email: params.to,
        link: `${getPublicAppUrl()}/admin/orders/${params.orderId}`,
      },
      outboxTemplate: "rtw-fulfilment-refused-admin",
      idempotencyKey: `rtw-fulfil-refused-admin:${params.orderId}`,
      relatedType: "Order",
      relatedId: params.orderId,
    });
  }
}

export async function sendPasswordResetEmail(to: string, resetUrl: string, tokenHash: string): Promise<void> {
  const copy = await catalogCopy(EMAIL_TEMPLATE_KEYS.PASSWORD_RESET, {
    firstName: "there",
    link: resetUrl,
  });
  const html = await renderBrandedEmail(<PasswordResetEmail resetUrl={copy.ctaLink || resetUrl} />);
  await sendEmail({
    to,
    subject: copy.subject,
    html,
    template: "password-reset",
    idempotencyKey: `password-reset:${tokenHash}`,
    relatedType: "User",
    relatedId: to,
  });
}

export async function sendAccountExistsEmail(to: string, loginUrl: string): Promise<void> {
  const copy = await catalogCopy(EMAIL_TEMPLATE_KEYS.ACCOUNT_EXISTS, {
    firstName: "there",
    link: loginUrl,
  });
  const html = await renderBrandedEmail(<AccountExistsEmail loginUrl={copy.ctaLink || loginUrl} />);
  await sendEmail({
    to,
    subject: copy.subject,
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
  const firstName = name.split(/\s+/)[0] ?? name;
  const copy = await catalogCopy(EMAIL_TEMPLATE_KEYS.BESPOKE_CONFIRMATION, {
    firstName,
    orderRef: requestNumber,
    outfitName: occasion,
  });
  const html = await renderBrandedEmail(
    <BespokeConfirmationEmail
      name={name}
      requestNumber={requestNumber}
      occasion={occasion}
      timeline={timeline}
      catalogHeading={copy.heading}
      catalogBody={copy.body1}
      catalogCtaLabel={copy.ctaLabel}
      catalogCtaHref={copy.ctaLink}
    />,
  );
  await sendEmail({
    to,
    subject: copy.subject,
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
  const firstName = params.clientName.split(/\s+/)[0] ?? params.clientName;
  await sendUsingCatalog({
    key: EMAIL_TEMPLATE_KEYS.BESPOKE_BALANCE_LINK,
    to: params.to,
    vars: {
      firstName,
      orderRef: params.requestNumber,
      amount: `₦${params.amountNGN.toLocaleString("en-NG")}`,
      link: params.payUrl,
    },
    extraHtml: `<p style="margin:16px 0 0;font-size:13px;color:#6B6B68;line-height:1.5;">If the button does not work, copy and paste this link:<br/><span style="word-break:break-all;">${escapeHtml(params.payUrl)}</span></p>`,
    outboxTemplate: "bespoke-balance-link",
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
  const copy = await catalogCopy(EMAIL_TEMPLATE_KEYS.REFERRAL_SUCCESS, {
    firstName: referrerName,
  });
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
    subject: copy.subject,
    html,
    template: "referral-success",
    idempotencyKey: `referral-success:${to}:${friendFirstName}:${pointsEarned}`,
  });
}

export async function sendOrderProductionStartedEmail(params: {
  to: string;
  firstName: string;
  orderNumber: string;
}): Promise<void> {
  const copy = await catalogCopy(EMAIL_TEMPLATE_KEYS.RTW_PRODUCTION_STARTED, {
    firstName: params.firstName,
    orderRef: params.orderNumber,
  });
  const html = await renderBrandedEmail(
    <OrderProductionStartedEmail
      firstName={params.firstName}
      orderNumber={params.orderNumber}
      catalogHeading={copy.heading}
      catalogBody={copy.body1}
      catalogCtaLabel={copy.ctaLabel}
      catalogCtaHref={copy.ctaLink}
    />,
  );
  await sendEmail({
    to: params.to,
    subject: copy.subject,
    html,
    template: "order-production-started",
    idempotencyKey: `order-production-started:${params.orderNumber}`,
    relatedType: "Order",
    relatedId: params.orderNumber,
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
  const copy = await catalogCopy(EMAIL_TEMPLATE_KEYS.RTW_ORDER_SHIPPED, {
    firstName: params.firstName,
    orderRef: params.orderNumber,
    link: `${getPublicAppUrl()}/account/orders`,
  });
  const html = await renderBrandedEmail(
    <OrderShippedEmail
      firstName={params.firstName}
      orderNumber={params.orderNumber}
      trackingNumber={params.trackingNumber}
      carrier={params.carrier}
      estimatedDays={params.estimatedDays}
      catalogHeading={copy.heading}
      catalogBody={copy.body1}
      catalogCtaLabel={copy.ctaLabel}
      catalogCtaHref={copy.ctaLink}
    />,
  );
  await sendEmail({
    to: params.to,
    subject: copy.subject,
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
  const pickupName = resolvePickupName(params.pickupName);
  const address = resolvePickupAddress(params.address);
  const copy = await catalogCopy(EMAIL_TEMPLATE_KEYS.PICKUP_READY, {
    firstName: params.firstName,
    orderRef: params.orderNumber,
    collectionCode: params.collectionCode,
    pickupName,
    pickupAddress: address,
    pickupHours: params.hours,
  });
  const html = await renderBrandedEmail(
    <PickupReadyEmail
      firstName={params.firstName}
      orderNumber={params.orderNumber}
      collectionCode={params.collectionCode}
      pickupName={pickupName}
      address={address}
      hours={params.hours}
      instructions={params.instructions}
      catalogHeading={copy.heading}
      catalogBody={copy.body1}
    />,
  );
  await sendEmail({
    to: params.to,
    subject: copy.subject,
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
  await sendUsingCatalog({
    key: EMAIL_TEMPLATE_KEYS.UNCOLLECTED_PICKUP,
    to: params.to,
    vars: {
      firstName: params.firstName,
      orderRef: params.orderNumber,
      collectionCode: params.collectionCode,
    },
    extraHtml: `<p>This piece has been ready for ${params.days} days.</p>`,
    outboxTemplate: "uncollected-pickup",
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
  bank: {
    bankName: string;
    accountNumber: string;
    accountName: string;
    iban?: string;
    swiftBic?: string;
    sortCode?: string;
    routingNumber?: string;
    intermediaryBank?: string;
    instructions?: string;
  };
  payUrl: string;
}): Promise<void> {
  const amountLabel =
    params.currency === "USD"
      ? `$${params.amountNGN.toLocaleString("en-US")}`
      : params.currency === "GBP"
        ? `£${params.amountNGN.toLocaleString("en-GB")}`
        : params.currency === "EUR"
          ? `€${params.amountNGN.toLocaleString("en-IE")}`
          : `₦${Math.round(params.amountNGN).toLocaleString("en-NG")}`;
  const copy = await catalogCopy(EMAIL_TEMPLATE_KEYS.SHIPPING_QUOTE, {
    firstName: params.firstName,
    orderRef: params.orderNumber,
    amount: amountLabel,
    link: params.payUrl,
  });
  const html = await renderBrandedEmail(
    <ShippingQuoteEmail
      firstName={params.firstName}
      orderNumber={params.orderNumber}
      amountLabel={amountLabel}
      paymentRef={params.paymentRef}
      bank={params.bank}
      payUrl={copy.ctaLink || params.payUrl}
    />,
  );
  await sendEmail({
    to: params.to,
    subject: copy.subject,
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
  const copy = await catalogCopy(EMAIL_TEMPLATE_KEYS.RTW_ORDER_DELIVERED, {
    firstName: params.firstName,
    orderRef: params.orderNumber,
    link: `${getPublicAppUrl()}/account/orders`,
  });
  const html = await renderBrandedEmail(
    <RtwOrderDeliveredEmail
      firstName={params.firstName}
      orderNumber={params.orderNumber}
      catalogHeading={copy.heading}
      catalogBody={copy.body1}
      catalogCtaLabel={copy.ctaLabel}
      catalogCtaHref={copy.ctaLink}
    />,
  );
  await sendEmail({
    to: params.to,
    subject: copy.subject,
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
  const copy = await catalogCopy(EMAIL_TEMPLATE_KEYS.BESPOKE_DELIVERED, {
    firstName: params.firstName,
    orderRef: params.orderRef,
    link: params.confirmUrl,
  });
  const html = await renderBrandedEmail(
    <BespokeDeliveredEmail
      firstName={params.firstName}
      orderRef={params.orderRef}
      confirmUrl={copy.ctaLink || params.confirmUrl}
      accountUrl={params.accountUrl}
      catalogHeading={copy.heading}
      catalogBody={copy.body1}
      catalogCtaLabel={copy.ctaLabel}
    />,
  );
  await sendEmail({
    to: params.to,
    subject: copy.subject,
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
  const copy = await catalogCopy(EMAIL_TEMPLATE_KEYS.RECEIPT_REMINDER, {
    firstName: params.firstName,
    orderRef: params.orderRef,
    link: params.confirmUrl,
  });
  const html = await renderBrandedEmail(
    <ReceiptReminderEmail
      firstName={params.firstName}
      orderRef={params.orderRef}
      confirmUrl={copy.ctaLink || params.confirmUrl}
      catalogHeading={copy.heading}
      catalogBody={copy.body1}
      catalogCtaLabel={copy.ctaLabel}
    />,
  );
  await sendEmail({
    to: params.to,
    subject: copy.subject,
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
  const copy = await catalogCopy(EMAIL_TEMPLATE_KEYS.BESPOKE_REVIEW_REQUEST, {
    firstName: params.firstName,
    orderRef: params.orderRef,
    outfitName: params.orderRef,
    link: params.reviewUrl,
  });
  const html = await renderBrandedEmail(
    <ReviewRequestEmail
      firstName={params.firstName}
      headline={copy.heading}
      bodyParagraph={copy.body1}
      ctaLabel={copy.ctaLabel || "Share your thoughts"}
      ctaUrl={copy.ctaLink || params.reviewUrl}
    />,
  );
  await sendEmail({
    to: params.to,
    subject: copy.subject,
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
  const copy = await catalogCopy(EMAIL_TEMPLATE_KEYS.LOYALTY_TIER_UPGRADE, {
    firstName: params.firstName,
  });
  const html = await renderBrandedEmail(
    <LoyaltyTierUpgradeEmail firstName={params.firstName} newTier={params.newTier} perks={params.perks} />,
  );
  await sendEmail({
    to: params.to,
    subject: copy.subject,
    html,
    template: "loyalty-tier-upgrade",
    idempotencyKey: `loyalty-tier:${params.to}:${params.newTier}`,
  });
}

export async function sendPointsExpiryEmail(params: {
  to: string;
  firstName: string;
  points: number;
  expiryLabel: string;
  userId: string;
  batchKey: string;
}): Promise<void> {
  const copy = await catalogCopy(EMAIL_TEMPLATE_KEYS.POINTS_EXPIRY, {
    firstName: params.firstName,
    date: params.expiryLabel,
  });
  const html = await renderBrandedEmail(
    <PointsExpiryEmail firstName={params.firstName} points={params.points} expiryLabel={params.expiryLabel} />,
  );
  await sendEmail({
    to: params.to,
    subject: copy.subject,
    html,
    template: "prudent-points-expiry",
    idempotencyKey: `prudent-points-expiry:${params.userId}:${params.batchKey}`,
    relatedType: "User",
    relatedId: params.userId,
    priority: EMAIL_PRIORITY_MARKETING,
  });
}

export async function sendReferralRewardEmail(params: {
  to: string;
  firstName: string;
  creditNGN: number;
  orderId?: string;
}): Promise<void> {
  const copy = await catalogCopy(EMAIL_TEMPLATE_KEYS.REFERRAL_REWARD, {
    firstName: params.firstName,
    amount: `₦${params.creditNGN.toLocaleString("en-NG")}`,
  });
  const html = await renderBrandedEmail(
    <ReferralRewardEmail firstName={params.firstName} creditNGN={params.creditNGN} />,
  );
  await sendEmail({
    to: params.to,
    subject: copy.subject,
    html,
    template: "referral-reward",
    idempotencyKey: params.orderId
      ? `referral-reward:${params.to}:${params.orderId}`
      : `referral-reward:${params.to}:${params.creditNGN}`,
    relatedType: params.orderId ? "Order" : undefined,
    relatedId: params.orderId,
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
  const copy = await catalogCopy(EMAIL_TEMPLATE_KEYS.STAGE_ASSIGNMENT, {
    firstName: params.firstName,
    orderRef: params.orderRef,
    outfitName: params.outfitName,
    stageName: params.stageName,
    link: `${getPublicAppUrl()}/admin`,
  });
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
    subject: copy.subject,
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
  const copy = await catalogCopy(EMAIL_TEMPLATE_KEYS.BACK_IN_STOCK, {
    outfitName: params.productName,
    size: params.size,
    link: `${getPublicAppUrl()}/product/${params.productSlug}`,
  });
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
    subject: copy.subject,
    html,
    template: "back-in-stock",
    idempotencyKey: `back-in-stock:${params.productSlug}:${params.size}:${params.to}`,
  });
}

function wrapHtml(title: string, inner: string, family: EmailFamily = "transactional"): string {
  const logoBlock = emailLogoWhiteUrl
    ? `<table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;">
<tr><td width="${EMAIL_LOGO_PX}" height="${EMAIL_LOGO_PX}" align="center" style="width:${EMAIL_LOGO_PX}px;height:${EMAIL_LOGO_PX}px;line-height:0;font-size:0;">
<img src="${emailLogoWhiteUrl}" alt="${title}" width="${EMAIL_LOGO_PX}" height="${EMAIL_LOGO_PX}" style="width:${EMAIL_LOGO_PX}px;height:${EMAIL_LOGO_PX}px;max-width:${EMAIL_LOGO_PX}px;max-height:${EMAIL_LOGO_PX}px;display:block;border:0;outline:none;-ms-interpolation-mode:bicubic;" />
</td></tr></table>`
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
<p style="margin:${logoBlock ? "14px 0 0" : "0"};font-size:11px;letter-spacing:0.28em;text-transform:uppercase;color:#C9A84C;font-family:Georgia,'Times New Roman',Times,serif;">${CUSTOMER_HOUSE_NAME}</p>
${headerHairline}
</td></tr>
${goldBar}
<tr><td style="padding:${pad};">${inner}</td></tr>
<tr><td bgcolor="#1A0F08" style="background:#1A0F08;padding:28px 36px;text-align:center;color:rgba(226,209,194,0.62);font-size:11px;font-family:Helvetica,Arial,sans-serif;">
<p style="margin:0 0 8px;font-family:Georgia,serif;">${CUSTOMER_HOUSE_NAME}</p>
<p style="margin:0 0 6px;">${escapeHtml(emailHouseAddress || HOUSE_ADDRESS_ONE_LINE)}</p>
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
  const list = params.lines
    .map(
      (l) =>
        `<li style="margin:0 0 6px;font-size:15px;line-height:1.5;">${escapeHtml(l.name)} × ${l.quantity}</li>`,
    )
    .join("");
  return sendUsingCatalog({
    key: EMAIL_TEMPLATE_KEYS.ABANDONED_CART,
    to: params.to,
    vars: {
      firstName: params.firstName,
      link: params.checkoutUrl,
    },
    extraHtml: `<ul style="margin:0 0 16px;padding-left:18px;">${list}</ul>`,
    outboxTemplate: "abandoned-cart",
    idempotencyKey: params.idempotencyKey,
    relatedType: "User",
    relatedId: params.userId,
    priority: EMAIL_PRIORITY_MARKETING,
  });
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
  await sendUsingCatalog({
    key: EMAIL_TEMPLATE_KEYS.STAGE_APPROVAL_REQUEST,
    to: params.to,
    vars: {
      firstName: first,
      orderRef: params.orderRef,
      stageName: params.stageLabel,
      link: params.approveUrl,
    },
    extraHtml: `${notes}${images ? `<div style="margin:16px 0;">${images}</div>` : ""}`,
    outboxTemplate: "stage-approval-request",
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
  const first = params.clientName.split(/\s+/)[0] ?? params.clientName;
  await sendUsingCatalog({
    key: EMAIL_TEMPLATE_KEYS.STAGE_APPROVAL_REMINDER,
    to: params.to,
    vars: {
      firstName: first,
      orderRef: params.orderRef,
      stageName: params.stageLabel,
      link: params.approveUrl,
    },
    outboxTemplate: "stage-approval-reminder",
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
  await sendUsingCatalog({
    key: EMAIL_TEMPLATE_KEYS.STAGE_CHANGES_REQUESTED,
    to: params.to,
    vars: {
      firstName: params.staffName,
      orderRef: params.orderRef,
      stageName: params.stageLabel,
      notes: params.comment,
      link: params.orderUrl,
    },
    extraHtml: `<p style="margin:16px 0;font-size:15px;line-height:1.5;white-space:pre-wrap;">${escapeHtml(params.comment)}</p>`,
    outboxTemplate: "stage-changes-requested",
    idempotencyKey: `stage-changes:${params.orderRef}:${params.stageLabel}`,
    relatedType: "BespokeOrder",
    relatedId: params.orderRef,
  });
}

export async function sendAdminNotificationEmail(
  subject: string,
  htmlInner: string,
  idempotencyKey?: string,
  mailbox: "operational" | "hr" = "operational",
): Promise<void> {
  const admin =
    mailbox === "hr" ? await resolveHrAlertEmail(getSetting) : await resolveAdminAlertEmail(getSetting);
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
  const firstName = params.clientName.split(/\s+/)[0] ?? params.clientName;
  const copy = await catalogCopy(EMAIL_TEMPLATE_KEYS.CONSULTATION_PENDING, {
    firstName,
    orderRef: params.bookingNumber,
  });
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
    subject: copy.subject,
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
  const firstName = params.clientName.split(/\s+/)[0] ?? params.clientName;
  const atelierAddress = params.isVirtual
    ? params.atelierAddress
    : resolvePickupAddress(params.atelierAddress);
  const copy = await catalogCopy(EMAIL_TEMPLATE_KEYS.CONSULTATION_CONFIRMED, {
    firstName,
    orderRef: params.bookingNumber,
    date: dateLabel,
  });
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
      atelierAddress={atelierAddress}
    />,
  );
  await sendEmail({
    to: params.to,
    subject: copy.subject,
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
  const firstName = params.clientName.split(/\s+/)[0] ?? params.clientName;
  const copy = await catalogCopy(EMAIL_TEMPLATE_KEYS.CONSULTATION_CANCELLED, {
    firstName,
    orderRef: params.bookingNumber,
  });
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
    subject: copy.subject,
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
  const copy = await catalogCopy(EMAIL_TEMPLATE_KEYS.SESSION_SUMMARY, {
    firstName: params.firstName,
    outfitName: "your consultation",
  });
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
    subject: copy.subject,
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
  const firstName = params.clientName.split(/\s+/)[0] ?? params.clientName;
  const copy = await catalogCopy(EMAIL_TEMPLATE_KEYS.MEETING_LINK, {
    firstName,
    link: params.meetingLink,
  });
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
    subject: copy.subject,
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
  const firstName = params.clientName.split(/\s+/)[0] ?? params.clientName;
  const copy = await catalogCopy(EMAIL_TEMPLATE_KEYS.CONSULTATION_RESCHEDULE, {
    firstName,
    orderRef: params.bookingNumber,
  });
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
    subject: copy.subject,
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
  const businessName = params.businessName ?? CUSTOMER_HOUSE_NAME;
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
  const copy = await catalogCopy(EMAIL_TEMPLATE_KEYS.INVOICE_ISSUED, {
    firstName: params.clientName.split(/\s+/)[0] ?? params.clientName,
    orderRef: params.invoiceNumber,
    amount: params.total,
    link: params.publicLink,
  });
  const html = await renderBrandedEmail(<InvoiceEmail {...props} />);
  await sendEmail({
    to: params.to,
    subject: copy.subject,
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
  const copy = await catalogCopy(EMAIL_TEMPLATE_KEYS.PRODUCT_REVIEW_REQUEST, {
    firstName: params.firstName,
    outfitName: params.productName,
    link: reviewUrl,
  });
  const html = await renderBrandedEmail(
    <ReviewRequestEmail
      firstName={params.firstName}
      headline={copy.heading}
      bodyParagraph={copy.body1}
      ctaLabel={copy.ctaLabel || "Share your review"}
      ctaUrl={copy.ctaLink || reviewUrl}
    />,
  );
  await sendEmail({
    to: params.to,
    subject: copy.subject,
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
  const copy = await catalogCopy(EMAIL_TEMPLATE_KEYS.CONSULTATION_REVIEW_REQUEST, {
    firstName: params.firstName,
    link: reviewUrl,
  });
  const html = await renderBrandedEmail(
    <ReviewRequestEmail
      firstName={params.firstName}
      headline={copy.heading}
      bodyParagraph={copy.body1}
      ctaLabel={copy.ctaLabel || "Share your experience"}
      ctaUrl={copy.ctaLink || reviewUrl}
    />,
  );
  await sendEmail({
    to: params.to,
    subject: copy.subject,
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
  const firstName = params.name.split(/\s+/)[0] ?? params.name;
  const copy = await catalogCopy(EMAIL_TEMPLATE_KEYS.JOB_APPLICATION_CONFIRMATION, {
    firstName,
    outfitName: params.jobTitle,
  });
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
    subject: copy.subject,
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
    "hr",
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
