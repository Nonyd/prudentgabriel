import { getPublicAppUrl } from "@/lib/app-url";

export const EMAIL_TEMPLATE_KEYS = {
  COLLECTION_CAMPAIGN: "collection_campaign",
  WELCOME_CREDENTIALS: "welcome_credentials",
  CONSULTATION_CONFIRMED: "consultation_confirmed",
  MEETING_LINK: "meeting_link",
  SESSION_SUMMARY: "session_summary",
  ATELIER_STAGE_UPDATE: "atelier_stage_update",
  INVOICE_ISSUED: "invoice_issued",
  QUOTE_APPROVAL: "quote_approval",
  PAYMENT_CONFIRMED: "payment_confirmed",
  BANK_TRANSFER_RECEIVED: "bank_transfer_received",
  BANK_TRANSFER_CONFIRMED: "bank_transfer_confirmed",
  RTW_ORDER_CONFIRMED: "rtw_order_confirmed",
  RTW_ORDER_SHIPPED: "rtw_order_shipped",
  RTW_ORDER_DELIVERED: "rtw_order_delivered",
  PRODUCT_REVIEW_REQUEST: "product_review_request",
  CONSULTATION_REVIEW_REQUEST: "consultation_review_request",
  PASSWORD_RESET: "password_reset",
  LOYALTY_TIER_UPGRADE: "loyalty_tier_upgrade",
  EVENT_REMINDER: "event_reminder",
  REFERRAL_REWARD: "referral_reward",
  BALANCE_REMINDER: "balance_reminder",
  DAILY_REPORT: "daily_report",
  WEEKLY_REPORT: "weekly_report",
  CONTACT_FORM: "contact_form",
  LOW_STOCK: "low_stock",
  LATE_STAFF: "late_staff",
  JOB_APPLICATION: "job_application",
  STAFF_INVITATION: "staff_invitation",
  STAGE_ASSIGNMENT: "stage_assignment",
} as const;

export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[keyof typeof EMAIL_TEMPLATE_KEYS];

export type EmailTemplateFields = {
  subject: string;
  heading: string;
  body_1: string;
  body_2: string;
  cta_label: string;
  cta_link: string;
  footer_note: string;
};

export type EmailTemplateMeta = {
  key: EmailTemplateKey;
  label: string;
  group: "client" | "admin" | "staff";
  sortOrder: number;
  defaults: EmailTemplateFields;
};

const APP = () => getPublicAppUrl();

const CLIENT_TEMPLATES: EmailTemplateMeta[] = [
  {
    key: EMAIL_TEMPLATE_KEYS.COLLECTION_CAMPAIGN,
    label: "Collection launch",
    group: "client",
    sortOrder: 0,
    defaults: {
      subject: "{{collectionName}} is here",
      heading: "{{collectionName}}",
      body_1: "A new collection from Prudential Atelier is ready. Explore the looks and shop the drop.",
      body_2: "",
      cta_label: "Shop the collection",
      cta_link: "{{collectionUrl}}",
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.WELCOME_CREDENTIALS,
    label: "Welcome & Credentials",
    group: "client",
    sortOrder: 1,
    defaults: {
      subject: "Welcome to Prudential Atelier, {{firstName}}",
      heading: "Welcome to the Atelier",
      body_1: "Dear {{firstName}},\n\nYour account is ready. Sign in with the credentials we provided to track orders, consultations, and your atelier journey.",
      body_2: "We are honoured to dress your story.",
      cta_label: "Sign in to your account",
      cta_link: `${APP()}/login`,
      footer_note: "If you did not request this account, please contact us.",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.CONSULTATION_CONFIRMED,
    label: "Consultation Confirmed",
    group: "client",
    sortOrder: 2,
    defaults: {
      subject: "Your consultation is confirmed — {{date}}",
      heading: "Consultation confirmed",
      body_1: "Dear {{firstName}},\n\nYour consultation with Prudential Atelier is confirmed for {{date}}.",
      body_2: "Please arrive a few minutes early. We look forward to meeting you.",
      cta_label: "View booking",
      cta_link: `${APP()}/account/consultations`,
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.MEETING_LINK,
    label: "Meeting Link",
    group: "client",
    sortOrder: 3,
    defaults: {
      subject: "Your virtual consultation link",
      heading: "Join your consultation",
      body_1: "Dear {{firstName}},\n\nYour virtual session is ready. Use the link below at your scheduled time.",
      body_2: "",
      cta_label: "Join meeting",
      cta_link: "{{link}}",
      footer_note: "Please test your connection a few minutes before the session.",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.SESSION_SUMMARY,
    label: "Session Summary",
    group: "client",
    sortOrder: 4,
    defaults: {
      subject: "Summary from your consultation",
      heading: "Thank you for your session",
      body_1: "Dear {{firstName}},\n\nThank you for consulting with us. Here is a summary of what we discussed and the next steps for {{outfitName}}.",
      body_2: "Our team will follow up with any materials or quotes discussed.",
      cta_label: "View your account",
      cta_link: `${APP()}/account`,
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.ATELIER_STAGE_UPDATE,
    label: "Atelier Stage Update",
    group: "client",
    sortOrder: 5,
    defaults: {
      subject: "Atelier update — {{outfitName}}",
      heading: "Your atelier order has progressed",
      body_1: "Dear {{firstName}},\n\nWe have an update on {{outfitName}} (ref {{orderRef}}).",
      body_2: "Track every stage of your garment in your account.",
      cta_label: "Track my order",
      cta_link: "{{link}}",
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.INVOICE_ISSUED,
    label: "Invoice Issued",
    group: "client",
    sortOrder: 6,
    defaults: {
      subject: "Invoice {{orderRef}} — {{amount}}",
      heading: "Your invoice is ready",
      body_1: "Dear {{firstName}},\n\nPlease find your invoice for {{amount}} attached to this notification.",
      body_2: "Payment details are included in your client portal.",
      cta_label: "View invoice",
      cta_link: "{{link}}",
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.QUOTE_APPROVAL,
    label: "Quote for Approval",
    group: "client",
    sortOrder: 7,
    defaults: {
      subject: "Quote ready for your approval",
      heading: "Review your quote",
      body_1: "Dear {{firstName}},\n\nYour quote for {{outfitName}} is ready for review.",
      body_2: "Please approve or share feedback at your earliest convenience.",
      cta_label: "Review quote",
      cta_link: "{{link}}",
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.PAYMENT_CONFIRMED,
    label: "Payment Confirmed",
    group: "client",
    sortOrder: 8,
    defaults: {
      subject: "Payment received — {{amount}}",
      heading: "Payment confirmed",
      body_1: "Dear {{firstName}},\n\nWe have received your payment of {{amount}} for {{orderRef}}.",
      body_2: "Thank you for your trust in Prudential Atelier.",
      cta_label: "View receipt",
      cta_link: "{{link}}",
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.BANK_TRANSFER_RECEIVED,
    label: "Bank Transfer Received",
    group: "client",
    sortOrder: 9,
    defaults: {
      subject: "We received your transfer receipt",
      heading: "Transfer receipt received",
      body_1: "Dear {{firstName}},\n\nThank you — we have received your bank transfer receipt and our team is verifying it.",
      body_2: "You will receive confirmation once payment is approved.",
      cta_label: "",
      cta_link: "",
      footer_note: "Verification typically takes 1–2 business days.",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.BANK_TRANSFER_CONFIRMED,
    label: "Bank Transfer Confirmed",
    group: "client",
    sortOrder: 10,
    defaults: {
      subject: "Your bank transfer is confirmed",
      heading: "Payment confirmed",
      body_1: "Dear {{firstName}},\n\nYour bank transfer of {{amount}} has been confirmed.",
      body_2: "Your order or booking is now active.",
      cta_label: "View account",
      cta_link: `${APP()}/account`,
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.RTW_ORDER_CONFIRMED,
    label: "RTW Order Confirmed",
    group: "client",
    sortOrder: 11,
    defaults: {
      subject: "Order {{orderRef}} confirmed",
      heading: "Thank you for your order",
      body_1: "Dear {{firstName}},\n\nWe have received your ready-to-wear order {{orderRef}}.",
      body_2: "We will notify you when it ships.",
      cta_label: "Track order",
      cta_link: "{{link}}",
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.RTW_ORDER_SHIPPED,
    label: "RTW Order Shipped",
    group: "client",
    sortOrder: 12,
    defaults: {
      subject: "Your order {{orderRef}} has shipped",
      heading: "Your parcel is on its way",
      body_1: "Dear {{firstName}},\n\nGreat news — order {{orderRef}} has left our atelier.",
      body_2: "",
      cta_label: "Track shipment",
      cta_link: "{{link}}",
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.RTW_ORDER_DELIVERED,
    label: "RTW Order Delivered",
    group: "client",
    sortOrder: 13,
    defaults: {
      subject: "Delivered — order {{orderRef}}",
      heading: "Enjoy your new piece",
      body_1: "Dear {{firstName}},\n\nYour order {{orderRef}} has been delivered.",
      body_2: "We hope you love it. Share your experience with us.",
      cta_label: "Leave a review",
      cta_link: "{{link}}",
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.PRODUCT_REVIEW_REQUEST,
    label: "Product Review Request",
    group: "client",
    sortOrder: 14,
    defaults: {
      subject: "How was your {{outfitName}}?",
      heading: "We would love your feedback",
      body_1: "Dear {{firstName}},\n\nYour recent purchase means a great deal to us. Would you share a quick review?",
      body_2: "",
      cta_label: "Write a review",
      cta_link: "{{link}}",
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.CONSULTATION_REVIEW_REQUEST,
    label: "Consultation Review Request",
    group: "client",
    sortOrder: 15,
    defaults: {
      subject: "How was your consultation?",
      heading: "Share your experience",
      body_1: "Dear {{firstName}},\n\nThank you for consulting with Prudential Atelier. Your feedback helps us serve you better.",
      body_2: "",
      cta_label: "Leave feedback",
      cta_link: "{{link}}",
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.PASSWORD_RESET,
    label: "Password Reset",
    group: "client",
    sortOrder: 16,
    defaults: {
      subject: "Reset your password",
      heading: "Password reset",
      body_1: "Dear {{firstName}},\n\nWe received a request to reset your password.",
      body_2: "If you did not request this, you can safely ignore this email.",
      cta_label: "Reset password",
      cta_link: "{{link}}",
      footer_note: "This link expires in 24 hours.",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.LOYALTY_TIER_UPGRADE,
    label: "Loyalty Tier Upgrade",
    group: "client",
    sortOrder: 17,
    defaults: {
      subject: "Congratulations — you've reached a new tier",
      heading: "Loyalty tier upgrade",
      body_1: "Dear {{firstName}},\n\nYou have unlocked new privileges in the Prudential Atelier loyalty programme.",
      body_2: "Explore your benefits in your account.",
      cta_label: "View benefits",
      cta_link: `${APP()}/account`,
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.EVENT_REMINDER,
    label: "Event Reminder",
    group: "client",
    sortOrder: 18,
    defaults: {
      subject: "Reminder — your event on {{date}}",
      heading: "Your event is approaching",
      body_1: "Dear {{firstName}},\n\nThis is a gentle reminder about your upcoming event on {{date}}.",
      body_2: "Reach out if you would like a styling consultation before the day.",
      cta_label: "Book a consultation",
      cta_link: `${APP()}/consultation`,
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.REFERRAL_REWARD,
    label: "Referral Reward",
    group: "client",
    sortOrder: 19,
    defaults: {
      subject: "Your referral reward",
      heading: "Thank you for referring a friend",
      body_1: "Dear {{firstName}},\n\nYour referral was successful — loyalty points have been added to your account.",
      body_2: "",
      cta_label: "View points",
      cta_link: `${APP()}/account`,
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.BALANCE_REMINDER,
    label: "Balance Reminder",
    group: "client",
    sortOrder: 20,
    defaults: {
      subject: "Balance due — {{amount}}",
      heading: "Friendly payment reminder",
      body_1: "Dear {{firstName}},\n\nA balance of {{amount}} remains on {{orderRef}}.",
      body_2: "Please settle at your earliest convenience to keep your atelier timeline on track.",
      cta_label: "Pay balance",
      cta_link: "{{link}}",
      footer_note: "",
    },
  },
];

const ADMIN_TEMPLATES: EmailTemplateMeta[] = [
  {
    key: EMAIL_TEMPLATE_KEYS.DAILY_REPORT,
    label: "Daily Report",
    group: "admin",
    sortOrder: 100,
    defaults: {
      subject: "Daily report — {{date}}",
      heading: "Daily operations summary",
      body_1: "Summary of today's activity across orders, consultations, and payments.",
      body_2: "",
      cta_label: "Open admin dashboard",
      cta_link: `${APP()}/admin`,
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.WEEKLY_REPORT,
    label: "Weekly Report",
    group: "admin",
    sortOrder: 101,
    defaults: {
      subject: "Weekly report — {{date}}",
      heading: "Weekly operations summary",
      body_1: "Your weekly performance and pipeline overview.",
      body_2: "",
      cta_label: "View reports",
      cta_link: `${APP()}/admin/reports`,
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.CONTACT_FORM,
    label: "New Contact Form",
    group: "admin",
    sortOrder: 102,
    defaults: {
      subject: "New contact: {{firstName}} — {{email}}",
      heading: "New contact form submission",
      body_1: "{{firstName}} ({{email}}) sent a message via the website contact form.",
      body_2: "",
      cta_label: "View message",
      cta_link: `${APP()}/admin/content/messages`,
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.LOW_STOCK,
    label: "Low Stock Alert",
    group: "admin",
    sortOrder: 103,
    defaults: {
      subject: "Low stock alert",
      heading: "Inventory attention needed",
      body_1: "One or more products are below the restock threshold.",
      body_2: "",
      cta_label: "View inventory",
      cta_link: `${APP()}/admin/products`,
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.LATE_STAFF,
    label: "Late Staff Alert",
    group: "admin",
    sortOrder: 104,
    defaults: {
      subject: "Late clock-in alert",
      heading: "Staff attendance alert",
      body_1: "A team member has not clocked in for their scheduled shift.",
      body_2: "",
      cta_label: "View attendance",
      cta_link: `${APP()}/admin/attendance`,
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.JOB_APPLICATION,
    label: "Job Application Received",
    group: "admin",
    sortOrder: 105,
    defaults: {
      subject: "New job application — {{firstName}}",
      heading: "New application received",
      body_1: "{{firstName}} {{lastName}} applied for an open role.",
      body_2: "",
      cta_label: "Review application",
      cta_link: `${APP()}/admin/careers/applications`,
      footer_note: "",
    },
  },
];

const STAFF_TEMPLATES: EmailTemplateMeta[] = [
  {
    key: EMAIL_TEMPLATE_KEYS.STAFF_INVITATION,
    label: "Staff Invitation",
    group: "staff",
    sortOrder: 200,
    defaults: {
      subject: "You're invited to Prudential Atelier staff portal",
      heading: "Welcome to the team",
      body_1: "Dear {{firstName}},\n\nYou have been invited to join the Prudential Atelier staff portal.",
      body_2: "Use the link below to set up your account.",
      cta_label: "Accept invitation",
      cta_link: "{{link}}",
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.STAGE_ASSIGNMENT,
    label: "Stage Assignment",
    group: "staff",
    sortOrder: 201,
    defaults: {
      subject: "New atelier assignment — {{orderRef}}",
      heading: "You have a new assignment",
      body_1: "You have been assigned to work on {{outfitName}} ({{orderRef}}).",
      body_2: "Please review the order details in the admin portal.",
      cta_label: "View order",
      cta_link: "{{link}}",
      footer_note: "",
    },
  },
];

export const EMAIL_TEMPLATE_CATALOG: EmailTemplateMeta[] = [
  ...CLIENT_TEMPLATES,
  ...ADMIN_TEMPLATES,
  ...STAFF_TEMPLATES,
];

export const EMAIL_TEMPLATE_BY_KEY = Object.fromEntries(
  EMAIL_TEMPLATE_CATALOG.map((t) => [t.key, t]),
) as Record<EmailTemplateKey, EmailTemplateMeta>;

export const EMAIL_TEMPLATE_FIELD_SUFFIXES = [
  "subject",
  "heading",
  "body_1",
  "body_2",
  "cta_label",
  "cta_link",
  "footer_note",
] as const;

export type EmailTemplateFieldSuffix = (typeof EMAIL_TEMPLATE_FIELD_SUFFIXES)[number];

export function emailSettingKey(templateKey: EmailTemplateKey, field: EmailTemplateFieldSuffix): string {
  return `email_${templateKey}_${field}`;
}

export function interpolateTemplateText(
  text: string,
  vars: Record<string, string>,
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}

export function demoTemplateVariables(): Record<string, string> {
  const date = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Lagos",
  }).format(new Date());

  return {
    firstName: "Amaka",
    lastName: "Adesanya",
    email: "amaka.adesanya@example.com",
    orderRef: "ORD-2847",
    outfitName: "Custom Asoebi Gown",
    amount: "₦325,000",
    date,
    link: getPublicAppUrl(),
    collectionName: "Rich & Regal",
    collectionUrl: `${getPublicAppUrl()}/collections/rich-regal`,
  };
}
