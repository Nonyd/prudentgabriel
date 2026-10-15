import { customerLoginUrl } from "@/lib/customer-email";
import { getPublicAppUrl } from "@/lib/app-url";
import type { EmailBrand } from "@/lib/email-branding";
import type { EmailSignOff } from "@/lib/email-sign-off";

export const EMAIL_TEMPLATE_KEYS = {
  COLLECTION_CAMPAIGN: "collection_campaign",
  WELCOME: "welcome",
  WELCOME_CREDENTIALS: "welcome_credentials",
  ACCOUNT_EXISTS: "account_exists",
  CONSULTATION_PENDING: "consultation_pending",
  CONSULTATION_PENDING_VIRTUAL: "consultation_pending_virtual",
  CONSULTATION_CONFIRMED: "consultation_confirmed",
  CONSULTATION_CANCELLED: "consultation_cancelled",
  CONSULTATION_RESCHEDULE: "consultation_reschedule",
  MEETING_LINK: "meeting_link",
  SESSION_SUMMARY: "session_summary",
  ATELIER_STAGE_UPDATE: "atelier_stage_update",
  ATELIER_STAGE_CONSULTATION_BOOKING: "atelier_stage_consultation_booking",
  ATELIER_STAGE_CONSULTATION_SESSION: "atelier_stage_consultation_session",
  ATELIER_STAGE_INVOICE: "atelier_stage_invoice",
  ATELIER_STAGE_PAYMENT: "atelier_stage_payment",
  ATELIER_STAGE_SKETCHING: "atelier_stage_sketching",
  ATELIER_STAGE_FABRIC: "atelier_stage_fabric",
  ATELIER_STAGE_DESIGN_APPROVAL: "atelier_stage_design_approval",
  ATELIER_STAGE_TAILORING: "atelier_stage_tailoring",
  ATELIER_STAGE_FIRST_FITTING: "atelier_stage_first_fitting",
  ATELIER_STAGE_ALTERATIONS: "atelier_stage_alterations",
  ATELIER_STAGE_BEADING: "atelier_stage_beading",
  ATELIER_STAGE_FINAL_FITTING: "atelier_stage_final_fitting",
  ATELIER_STAGE_DELIVERY: "atelier_stage_delivery",
  STAGE_APPROVAL_REQUEST: "stage_approval_request",
  STAGE_APPROVAL_REMINDER: "stage_approval_reminder",
  STAGE_CHANGES_REQUESTED: "stage_changes_requested",
  BESPOKE_CONFIRMATION: "bespoke_confirmation",
  BESPOKE_BALANCE_LINK: "bespoke_balance_link",
  BESPOKE_DELIVERED: "bespoke_delivered",
  BESPOKE_REVIEW_REQUEST: "bespoke_review_request",
  RECEIPT_REMINDER: "receipt_reminder",
  INVOICE_ISSUED: "invoice_issued",
  QUOTE_APPROVAL: "quote_approval",
  PAYMENT_CONFIRMED: "payment_confirmed",
  PAYMENT_REJECTED: "payment_rejected",
  BANK_TRANSFER_RECEIVED: "bank_transfer_received",
  BANK_TRANSFER_CONFIRMED: "bank_transfer_confirmed",
  BANK_TRANSFER_ADMIN: "bank_transfer_admin",
  RTW_ORDER_CONFIRMED: "rtw_order_confirmed",
  RTW_PRODUCTION_STARTED: "rtw_production_started",
  RTW_ORDER_SHIPPED: "rtw_order_shipped",
  RTW_ORDER_DELIVERED: "rtw_order_delivered",
  RTW_FULFILMENT_REFUSED: "rtw_fulfilment_refused",
  RTW_FULFILMENT_REFUSED_ADMIN: "rtw_fulfilment_refused_admin",
  PICKUP_READY: "pickup_ready",
  UNCOLLECTED_PICKUP: "uncollected_pickup",
  SHIPPING_QUOTE: "shipping_quote",
  ABANDONED_CART: "abandoned_cart",
  PRODUCT_REVIEW_REQUEST: "product_review_request",
  CONSULTATION_REVIEW_REQUEST: "consultation_review_request",
  PASSWORD_RESET: "password_reset",
  LOYALTY_TIER_UPGRADE: "loyalty_tier_upgrade",
  POINTS_EXPIRY: "points_expiry",
  EVENT_REMINDER: "event_reminder",
  REFERRAL_SUCCESS: "referral_success",
  REFERRAL_REWARD: "referral_reward",
  BALANCE_REMINDER: "balance_reminder",
  JOB_APPLICATION_CONFIRMATION: "job_application_confirmation",
  JOB_APPLICATION_STATUS: "job_application_status",
  DAILY_REPORT: "daily_report",
  WEEKLY_REPORT: "weekly_report",
  CONTACT_FORM: "contact_form",
  LATE_STAFF: "late_staff",
  JOB_APPLICATION: "job_application",
  ADMIN_CONSULTATION: "admin_consultation",
  STAFF_INVITATION: "staff_invitation",
  STAGE_ASSIGNMENT: "stage_assignment",
  CONSULTATION_ENQUIRY_RECEIVED: "consultation_enquiry_received",
  CONSULTATION_ENQUIRY_APPROVED: "consultation_enquiry_approved",
  CONSULTATION_ENQUIRY_DECLINED: "consultation_enquiry_declined",
  CONSULTATION_DAY_BEFORE: "consultation_day_before",
  CHAT_REPLY: "chat_reply",
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

export type EmailLane = "rtw" | "mto" | "consult" | "account" | "marketing" | "ops";

export type EmailTemplateMeta = {
  key: EmailTemplateKey;
  label: string;
  group: "client" | "admin" | "staff";
  lane?: EmailLane;
  sortOrder: number;
  defaults: EmailTemplateFields;
  /** Client mail only. Defaults to "With love," and the brand's team. */
  signOff?: EmailSignOff;
};

export function resolveEmailLane(meta: Pick<EmailTemplateMeta, "key" | "group" | "lane">): EmailLane {
  if (meta.lane) return meta.lane;
  if (meta.group !== "client") return "ops";
  const k = meta.key;
  if (
    k.startsWith("rtw_") ||
    k === "product_review_request" ||
    k === "pickup_ready" ||
    k === "uncollected_pickup" ||
    k === "abandoned_cart" ||
    k === "shipping_quote"
  ) {
    return "rtw";
  }
  if (
    k.startsWith("atelier_") ||
    k.startsWith("bespoke_") ||
    k.startsWith("stage_") ||
    k === "invoice_issued" ||
    k === "quote_approval" ||
    k === "balance_reminder" ||
    k === "receipt_reminder"
  ) {
    return "mto";
  }
  if (
    k.startsWith("consultation_") ||
    k === "meeting_link" ||
    k === "session_summary" ||
    k === "event_reminder" ||
    k === "admin_consultation"
  ) {
    return "consult";
  }
  if (k === "collection_campaign") return "marketing";
  return "account";
}

const APP = () => getPublicAppUrl();

const CLIENT_TEMPLATES: EmailTemplateMeta[] = [
  {
    key: EMAIL_TEMPLATE_KEYS.COLLECTION_CAMPAIGN,
    label: "Collection launch",
    group: "client",
    sortOrder: 0,
    defaults: {
      subject: "{{collectionName}} has arrived — we think you'll love it",
      heading: "{{collectionName}}",
      body_1: "We have been so excited to share this one with you. {{collectionName}} is here, every piece made with the care and craftsmanship you trust Prudent Gabriel for.",
      body_2: "Take a moment to explore the looks. We cannot wait to see which one becomes yours.",
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
      subject: "Welcome to Prudent Gabriel, {{firstName}}",
      heading: "Welcome to Prudent Gabriel",
      body_1: "Dear {{firstName}},\n\nWe are truly delighted to welcome you. Your account is where you can follow your commission, view your invoices, and keep everything about your piece in one place.\n\nDesign approval and receipt confirmation will each arrive as their own link by email, so you never need to sign in for those.",
      body_2: "Thank you for trusting us with your story. We are honoured to be part of it.",
      cta_label: "Sign in to your account",
      cta_link: customerLoginUrl(),
      footer_note: "If you did not request this account, please contact us.",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.CONSULTATION_CONFIRMED,
    label: "Consultation Confirmed",
    group: "client",
    sortOrder: 2,
    defaults: {
      subject: "Your consultation is confirmed — we cannot wait to meet you",
      heading: "Your consultation is confirmed",
      body_1: "Dear {{firstName}},\n\nWonderful news! Your consultation with Prudent Gabriel is confirmed for {{date}}.\n\nWe have been looking forward to this, and we cannot wait to hear all about your vision.",
      body_2: "Please arrive a few minutes early so we can welcome you properly and make the most of our time together.",
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
      subject: "Your consultation link is ready",
      heading: "We are ready for you",
      body_1: "Dear {{firstName}},\n\nYour virtual consultation is all set, and we are so looking forward to speaking with you. Use the link below at your scheduled time.",
      body_2: "",
      cta_label: "Join meeting",
      cta_link: "{{link}}",
      footer_note: "Do test your connection a few minutes before we begin, so nothing comes between us and your vision.",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.SESSION_SUMMARY,
    label: "Session Summary",
    group: "client",
    sortOrder: 4,
    defaults: {
      subject: "Thank you for a beautiful consultation",
      heading: "Thank you for your time with us",
      body_1: "Dear {{firstName}},\n\nThank you for spending this time with us. It was a joy to hear your vision, and we are already excited about what comes next for {{outfitName}}.\n\nHere is a summary of what we discussed and the next steps.",
      body_2: "Our team will follow up with any materials or quotes we talked about, and we will keep you informed at every important stage.",
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
      subject: "A new chapter for {{outfitName}}",
      heading: "Your piece has taken another step",
      body_1: "Dear {{firstName}},\n\nWe have an exciting update on {{outfitName}} (ref {{orderRef}}). Every stage brings your vision a little closer, and we wanted you to share in it.",
      body_2: "You can follow every stage of your piece in your account.",
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
      subject: "Your invoice is ready — {{orderRef}}",
      heading: "Your invoice is ready",
      body_1: "Dear {{firstName}},\n\nThank you for choosing Prudent Gabriel. Your invoice for {{amount}} is ready, and with it the next step in bringing your piece to life.",
      body_2: "All payment details are in your client portal. If anything is unclear, simply reply to this email. We are always happy to help.",
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
      subject: "Your quote is ready, {{firstName}}",
      heading: "Your quote is ready for you",
      body_1: "Dear {{firstName}},\n\nWe have loved working through the details of {{outfitName}}, and your quote is now ready for your review.",
      body_2: "Take your time with it. If you would like to change anything, share your thoughts and we will work through them together.",
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
      subject: "Thank you — your payment is confirmed",
      heading: "Payment confirmed",
      body_1: "Dear {{firstName}},\n\nThank you. We have received your payment of {{amount}} for {{orderRef}}.",
      body_2: "We do not take your trust lightly, and we are excited to keep moving forward with you.",
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
      subject: "Thank you — we have your transfer receipt",
      heading: "We have your receipt",
      body_1: "Dear {{firstName}},\n\nThank you for sending your bank transfer receipt. Our team is verifying it now.",
      body_2: "We will write to you as soon as your payment is confirmed.",
      cta_label: "",
      cta_link: "",
      footer_note: "Verification usually takes 1–2 business days.",
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
      body_1: "Dear {{firstName}},\n\nThank you. Your bank transfer of {{amount}} has been confirmed.",
      body_2: "Everything is now in motion, and we are delighted to be on this journey with you.",
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
      subject: "Thank you for your order, {{firstName}}",
      heading: "Thank you for your order",
      body_1: "Dear {{firstName}},\n\nThank you for choosing Prudent Gabriel. We are delighted to have your order {{orderRef}}, and we cannot wait for you to wear it.",
      body_2: "Your piece will be prepared with care, and we will let you know the moment it is on its way.",
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
      subject: "Your piece is on its way — order {{orderRef}}",
      heading: "Your parcel is on its way",
      body_1: "Dear {{firstName}},\n\nExciting news! Order {{orderRef}} has left our atelier and is on its way to you.",
      body_2: "We hope it brings you as much joy to wear as it brought us to make.",
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
      subject: "Your piece has arrived — order {{orderRef}}",
      heading: "Enjoy your new piece",
      body_1: "Dear {{firstName}},\n\nYour order {{orderRef}} has been delivered. We hope you love it as much as we loved making it for you.",
      body_2: "If you have a moment, we would be so grateful to hear how it feels.",
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
      subject: "How are you enjoying your {{outfitName}}?",
      heading: "We would love to hear from you",
      body_1: "Dear {{firstName}},\n\nYour purchase means a great deal to us, and we would truly love to know how your piece makes you feel.",
      body_2: "A few words from you help us keep doing what we love.",
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
      subject: "How was your consultation with us?",
      heading: "Share your experience",
      body_1: "Dear {{firstName}},\n\nThank you for spending time with Prudent Gabriel. We hope your consultation felt as special to you as it did to us.",
      body_2: "Your thoughts help us make every consultation even more meaningful.",
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
      heading: "Reset your password",
      body_1: "Dear {{firstName}},\n\nWe received a request to reset your password. Use the button below to choose a new one.",
      body_2: "If you did not ask for this, you can safely ignore this email. Your account is unchanged.",
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
      subject: "Congratulations, {{firstName}} — you have reached a new tier",
      heading: "A new tier, just for you",
      body_1: "Dear {{firstName}},\n\nCongratulations! You have unlocked new privileges in the Prudent Gabriel loyalty programme. Thank you for being such a special part of our story.",
      body_2: "Your new benefits are waiting for you in your account.",
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
      subject: "Your event on {{date}} is getting closer",
      heading: "Your special day is approaching",
      body_1: "Dear {{firstName}},\n\nYour event on {{date}} is getting closer, and we would love to help you look and feel your very best.",
      body_2: "If you would like a styling consultation before the day, we would be delighted to see you.",
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
      subject: "Thank you for sharing Prudent Gabriel",
      heading: "Thank you for referring a friend",
      body_1: "Dear {{firstName}},\n\nThank you for sharing Prudent Gabriel with someone you love. Your referral was successful, and Prudent Points have been added to your account.",
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
      subject: "A gentle reminder — balance on {{orderRef}}",
      heading: "A gentle reminder",
      body_1: "Dear {{firstName}},\n\nYour piece is coming along beautifully. A balance of {{amount}} remains on {{orderRef}}.",
      body_2: "Settling it at your convenience keeps everything on track for your special day. If you have any questions, simply reply. We are here for you.",
      cta_label: "Pay balance",
      cta_link: "{{link}}",
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.WELCOME,
    label: "Welcome",
    group: "client",
    sortOrder: 21,
    defaults: {
      subject: "Welcome to Prudent Gabriel, {{firstName}}",
      heading: "Welcome to Prudent Gabriel",
      body_1: "Dear {{firstName}},\n\nWe are truly delighted to welcome you. Your account is ready, and we are honoured to be part of your story.",
      body_2: "We cannot wait to dress you for the moments that matter.",
      cta_label: "Visit your account",
      cta_link: `${APP()}/account`,
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.ACCOUNT_EXISTS,
    label: "Account already exists",
    group: "client",
    sortOrder: 22,
    defaults: {
      subject: "You already have a Prudent Gabriel account",
      heading: "Welcome back",
      body_1: "Dear {{firstName}},\n\nIt is lovely to see you again. An account with this email is already registered, so simply sign in to continue.",
      body_2: "",
      cta_label: "Sign in",
      cta_link: "{{link}}",
      footer_note: "If you did not try to register, you can ignore this message.",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.CONSULTATION_PENDING,
    label: "Consultation paid — physical (how to prepare)",
    group: "client",
    sortOrder: 23,
    defaults: {
      subject: "Thank you, {{firstName}} — we cannot wait to meet you",
      heading: "Dear {{firstName}},",
      // Opening and closing only; the four preparation notes are in consultation-prep-copy.ts.
      body_1:
        "Thank you for your consultation payment and for choosing Prudent Gabriel.\n\nWe are already excited about the beautiful journey ahead and cannot wait to begin bringing your dream dress to life!",
      body_2:
        "Our goal is to make this experience intentional, collaborative, and enjoyable, ensuring that we understand your vision and guide you confidently through the process.\n\nWe believe creating your dream dress should be just as beautiful as wearing it, and we look forward to making this journey a memorable one.\n\nThank you once again for trusting Prudent Gabriel Atelier. We cannot wait to meet you!",
      cta_label: "View booking",
      cta_link: `${APP()}/account/consultations`,
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.CONSULTATION_PENDING_VIRTUAL,
    label: "Consultation paid — virtual (how to prepare)",
    group: "client",
    sortOrder: 23,
    defaults: {
      subject: "Your virtual consultation with Prudent Gabriel Atelier, {{firstName}}",
      heading: "Dear {{firstName}},",
      // Opening and closing only; the four preparation notes are in consultation-prep-copy.ts.
      body_1:
        "Thank you for your payment. We are pleased to confirm your virtual consultation with Prudent Gabriel Atelier.\n\nWe are excited to begin this journey with you and look forward to working together to bring your dream dress to life.",
      body_2:
        "We believe creating your dream dress should be an intentional and collaborative experience. Throughout this journey, we are committed to clear communication, transparency, and thoughtful attention to every detail.\n\nThank you for trusting us with something so special. We cannot wait to bring your vision to life!",
      cta_label: "View booking",
      cta_link: `${APP()}/account/consultations`,
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.CONSULTATION_CANCELLED,
    label: "Consultation cancelled",
    group: "client",
    sortOrder: 24,
    defaults: {
      subject: "Your consultation {{orderRef}} has been cancelled",
      heading: "Your consultation was cancelled",
      body_1: "Dear {{firstName}},\n\nYour consultation {{orderRef}} has been cancelled.",
      body_2: "Whenever you are ready, we would love to welcome you again. Our door is always open to you.",
      cta_label: "Book again",
      cta_link: `${APP()}/consultation`,
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.CONSULTATION_RESCHEDULE,
    label: "Consultation reschedule",
    group: "client",
    sortOrder: 25,
    defaults: {
      subject: "A new date for your consultation — {{orderRef}}",
      heading: "We have proposed a new time",
      body_1: "Dear {{firstName}},\n\nWe are so looking forward to meeting you, and we have proposed a new date for consultation {{orderRef}}. Please take a look and let us know what works for you.",
      body_2: "Thank you for your patience and understanding.",
      cta_label: "View booking",
      cta_link: `${APP()}/account/consultations`,
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.ATELIER_STAGE_CONSULTATION_BOOKING,
    label: "MTO — Consultation booked",
    group: "client",
    sortOrder: 30,
    defaults: {
      subject: "Your consultation is confirmed — Prudent Gabriel",
      heading: "Your consultation is confirmed",
      body_1: "Your consultation has been confirmed. We cannot wait to understand your vision and begin crafting something truly special for you.",
      body_2: "You can follow every stage of your piece in your account.",
      cta_label: "Track my order",
      cta_link: "{{link}}",
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.ATELIER_STAGE_CONSULTATION_SESSION,
    label: "MTO — Consultation summary",
    group: "client",
    sortOrder: 31,
    defaults: {
      subject: "Your consultation summary — {{orderRef}}",
      heading: "Thank you for your session",
      body_1: "Thank you for a wonderful consultation. It was a joy to hear your vision. Here is a summary of what we discussed and the direction for your commission.",
      body_2: "You can follow every stage of your piece in your account.",
      cta_label: "Track my order",
      cta_link: "{{link}}",
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.ATELIER_STAGE_INVOICE,
    label: "MTO — Quote ready",
    group: "client",
    sortOrder: 32,
    defaults: {
      subject: "Your quote is ready for review — {{orderRef}}",
      heading: "Your quote is ready",
      body_1: "Your personalised quote is ready. Take a moment to review the details, and approve when you feel ready to begin this journey with us.",
      body_2: "You can follow every stage of your piece in your account.",
      cta_label: "Review quote",
      cta_link: "{{link}}",
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.ATELIER_STAGE_PAYMENT,
    label: "MTO — Payment received, production begins",
    group: "client",
    sortOrder: 33,
    defaults: {
      subject: "Payment received — your dress journey begins now",
      heading: "Your piece is in production",
      body_1: "Thank you. We have received your payment, and your commission is now officially in production. Our atelier team has begun work on your piece with the utmost care.",
      body_2: "You can follow every stage of your piece in your account.",
      cta_label: "Track my order",
      cta_link: "{{link}}",
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.ATELIER_STAGE_SKETCHING,
    label: "MTO — Design concept",
    group: "client",
    sortOrder: 34,
    defaults: {
      subject: "Your design concept is ready — {{orderRef}}",
      heading: "Your design concept",
      body_1: "Our design team has prepared the first concepts for your dress. We have poured your vision into every line, and we cannot wait to hear what you think.",
      body_2: "You can follow every stage of your piece in your account.",
      cta_label: "View concepts",
      cta_link: "{{link}}",
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.ATELIER_STAGE_FABRIC,
    label: "MTO — Fabrics sourced",
    group: "client",
    sortOrder: 35,
    defaults: {
      subject: "Your fabrics have been sourced — {{orderRef}}",
      heading: "Fabrics sourced",
      body_1: "We have sourced the fabrics for your piece. Each one has been thoughtfully chosen to bring your design to life with the beauty and quality it deserves.",
      body_2: "You can follow every stage of your piece in your account.",
      cta_label: "Track my order",
      cta_link: "{{link}}",
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.ATELIER_STAGE_DESIGN_APPROVAL,
    label: "MTO — Design approval",
    group: "client",
    sortOrder: 36,
    defaults: {
      subject: "Please review your final design — {{orderRef}}",
      heading: "Please review your design",
      body_1: "Your final design is ready for your review. Please take your time, and confirm that everything feels just right before we begin construction.",
      body_2: "You can follow every stage of your piece in your account.",
      cta_label: "Review & approve",
      cta_link: "{{link}}",
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.ATELIER_STAGE_TAILORING,
    label: "MTO — Tailoring",
    group: "client",
    sortOrder: 37,
    defaults: {
      subject: "Your dress is being crafted — {{orderRef}}",
      heading: "In the atelier",
      body_1: "Your dress is now being crafted in our atelier. Our tailors are bringing your design to life with meticulous attention to every detail.",
      body_2: "You can follow every stage of your piece in your account.",
      cta_label: "Track my order",
      cta_link: "{{link}}",
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.ATELIER_STAGE_FIRST_FITTING,
    label: "MTO — First fitting",
    group: "client",
    sortOrder: 38,
    defaults: {
      subject: "Your first fitting summary — {{orderRef}}",
      heading: "First fitting complete",
      body_1: "Thank you for your first fitting. It was wonderful to see your dress begin to take shape on you. Below are the notes from your session and the adjustments we will be making.",
      body_2: "You can follow every stage of your piece in your account.",
      cta_label: "Track my order",
      cta_link: "{{link}}",
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.ATELIER_STAGE_ALTERATIONS,
    label: "MTO — Alterations",
    group: "client",
    sortOrder: 39,
    defaults: {
      subject: "Alterations complete — {{orderRef}}",
      heading: "Alterations complete",
      body_1: "All requested alterations are complete. Your dress has been refined so the fit and finish feel exactly right.",
      body_2: "You can follow every stage of your piece in your account.",
      cta_label: "Track my order",
      cta_link: "{{link}}",
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.ATELIER_STAGE_BEADING,
    label: "MTO — Beading & finishing",
    group: "client",
    sortOrder: 40,
    defaults: {
      subject: "The finishing touches are complete — {{orderRef}}",
      heading: "Finishing touches complete",
      body_1: "The beading, embroidery and final details are finished, and your piece is truly coming alive. It is ready for your final fitting.",
      body_2: "You can follow every stage of your piece in your account.",
      cta_label: "Track my order",
      cta_link: "{{link}}",
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.ATELIER_STAGE_FINAL_FITTING,
    label: "MTO — Final fitting",
    group: "client",
    sortOrder: 41,
    defaults: {
      subject: "Final fitting complete — {{orderRef}}",
      heading: "Final fitting complete",
      body_1: "Your final fitting is complete, and we could not be more excited. We are now lovingly preparing your piece for delivery.",
      body_2: "You can follow every stage of your piece in your account.",
      cta_label: "Track my order",
      cta_link: "{{link}}",
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.ATELIER_STAGE_DELIVERY,
    label: "MTO — Ready for delivery",
    group: "client",
    sortOrder: 42,
    defaults: {
      subject: "Your dress is ready — {{orderRef}}",
      heading: "Your dress is ready",
      body_1: "Your dress is ready! We cannot wait for you to experience the finished piece. Details for collection or delivery are below.",
      body_2: "You can follow every stage of your piece in your account.",
      cta_label: "Track my order",
      cta_link: "{{link}}",
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.STAGE_APPROVAL_REQUEST,
    label: "MTO — Please approve this stage",
    group: "client",
    sortOrder: 43,
    defaults: {
      subject: "Ready for your review — {{stageName}}, {{orderRef}}",
      heading: "Ready for your eyes",
      body_1: "Dear {{firstName}},\n\nWe are excited to share {{stageName}} on order {{orderRef}} with you. Please take a look and let us know your thoughts.",
      body_2: "Your decisions guide every step, and we want this to feel exactly right for you.",
      cta_label: "Review & approve",
      cta_link: "{{link}}",
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.STAGE_APPROVAL_REMINDER,
    label: "MTO — Approval reminder",
    group: "client",
    sortOrder: 44,
    defaults: {
      subject: "A gentle reminder: {{stageName}} — {{orderRef}}",
      heading: "We would love your thoughts",
      body_1: "Dear {{firstName}},\n\nJust a gentle reminder that {{stageName}} on order {{orderRef}} is ready for your review. Your approval or feedback lets us keep moving forward.",
      body_2: "",
      cta_label: "Review now",
      cta_link: "{{link}}",
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.BESPOKE_CONFIRMATION,
    label: "MTO — Request received",
    group: "client",
    sortOrder: 45,
    defaults: {
      subject: "We have your atelier request — {{orderRef}}",
      heading: "Thank you for your request",
      body_1: "Dear {{firstName}},\n\nThank you for choosing Prudent Gabriel. We have received your atelier request {{orderRef}}, and we are truly excited to learn more about your vision. Our team will review it within 24–48 hours.",
      body_2: "Occasion: {{outfitName}}",
      cta_label: "Browse ready-to-wear",
      cta_link: `${APP()}/rtw`,
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.BESPOKE_BALANCE_LINK,
    label: "MTO — Pay outstanding balance",
    group: "client",
    sortOrder: 46,
    defaults: {
      subject: "Your balance is ready — {{orderRef}}",
      heading: "The final step",
      body_1: "Dear {{firstName}},\n\nYour commission {{orderRef}} is ready for payment. Please complete the outstanding balance of {{amount}} using the button below.",
      body_2: "Thank you for trusting us with something so special.",
      cta_label: "Pay now",
      cta_link: "{{link}}",
      footer_note: "If the button does not work, copy the link from this email into your browser.",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.BESPOKE_DELIVERED,
    label: "MTO — Commission delivered",
    group: "client",
    sortOrder: 47,
    defaults: {
      subject: "Your dress {{orderRef}} has been delivered",
      heading: "Your dress is with you",
      body_1: "Dear {{firstName}},\n\nYour dress {{orderRef}} is ready and has been marked delivered. We hope it takes your breath away.\n\nPlease confirm you have received it. Confirming receipt opens a {{warrantyDays}}-day window to request a fit or workmanship alteration. It does not close your file.",
      body_2: "After you confirm, you have {{warrantyDays}} days to ask for any adjustment.",
      cta_label: "Confirm receipt",
      cta_link: "{{link}}",
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.BESPOKE_REVIEW_REQUEST,
    label: "MTO — Review request",
    group: "client",
    sortOrder: 48,
    defaults: {
      subject: "How do you feel in your dress, {{firstName}}?",
      heading: "We would love to hear from you",
      body_1: "Dear {{firstName}},\n\nYour piece {{orderRef}} is with you, and we hope you love every detail. It was an honour to be part of your journey, and we would be so grateful to hear about your experience.",
      body_2: "",
      cta_label: "Share your thoughts",
      cta_link: "{{link}}",
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.RECEIPT_REMINDER,
    label: "MTO — Confirm receipt reminder",
    group: "client",
    sortOrder: 49,
    defaults: {
      subject: "A gentle reminder: confirm receipt of {{orderRef}}",
      heading: "Has your dress reached you?",
      body_1: "Dear {{firstName}},\n\nYour commission {{orderRef}} was marked delivered a week ago, and we hope you are loving it. Please confirm receipt. That opens a {{warrantyDays}}-day window to request a fit or workmanship alteration, and it does not close your file.",
      body_2: "",
      cta_label: "Confirm receipt",
      cta_link: "{{link}}",
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.PAYMENT_REJECTED,
    label: "Payment not confirmed",
    group: "client",
    sortOrder: 50,
    defaults: {
      subject: "We could not confirm your payment — {{orderRef}}",
      heading: "We could not confirm your payment",
      body_1: "Dear {{firstName}},\n\nWe are sorry, but we could not confirm your payment of {{amount}} for {{orderRef}}.",
      body_2: "Please get in touch or try again. We are here to help you sort it out quickly.",
      cta_label: "Contact us",
      cta_link: `${APP()}/contact`,
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.RTW_PRODUCTION_STARTED,
    label: "RTW — Production started",
    group: "client",
    sortOrder: 51,
    defaults: {
      subject: "We have started making your piece — #{{orderRef}}",
      heading: "Your piece is being made",
      body_1: "Dear {{firstName}},\n\nExciting news! Our atelier has begun making your piece for order {{orderRef}}. It is being crafted with care, just for you.",
      body_2: "We will write again when it is on its way, or when it is ready to collect.",
      cta_label: "View your order",
      cta_link: `${APP()}/account/orders`,
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.RTW_FULFILMENT_REFUSED,
    label: "RTW — Could not fulfil",
    group: "client",
    sortOrder: 52,
    defaults: {
      subject: "We could not fulfil order #{{orderRef}} — refund underway",
      heading: "We could not fulfil this order",
      body_1: "Dear {{firstName}},\n\nThank you for your order {{orderRef}}. Your payment of {{amount}} was received, but we are truly sorry: we could not make this piece as ordered.",
      body_2: "We will not ship a substitute. A refund of the full amount will be issued. If you have not seen it within a few working days, write to us.",
      cta_label: "Contact us",
      cta_link: `${APP()}/contact`,
      footer_note: "We are sorry. This should not happen, and we are treating it with the seriousness it deserves.",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.PICKUP_READY,
    label: "RTW — Ready for collection",
    group: "client",
    sortOrder: 53,
    defaults: {
      subject: "Your piece is ready for you — #{{orderRef}}",
      heading: "Your piece is ready",
      body_1: "Dear {{firstName}},\n\nYour piece is ready and waiting for you! Order {{orderRef}} can be collected with code {{collectionCode}}.",
      body_2: "{{pickupName}}\n{{pickupAddress}}\n{{pickupHours}}",
      cta_label: "View order",
      cta_link: `${APP()}/account/orders`,
      footer_note: "Please bring the code and a matching ID.",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.UNCOLLECTED_PICKUP,
    label: "RTW — Uncollected pickup reminder",
    group: "client",
    sortOrder: 54,
    defaults: {
      subject: "Your piece is still waiting for you — #{{orderRef}}",
      heading: "We are keeping it safe for you",
      body_1: "Dear {{firstName}},\n\nYour order {{orderRef}} is ready and we are keeping it safe for you. Your collection code is {{collectionCode}}.",
      body_2: "Please collect it whenever you can, or write to us if you need a little more time.",
      cta_label: "Contact us",
      cta_link: `${APP()}/contact`,
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.SHIPPING_QUOTE,
    label: "RTW — Shipping quote",
    group: "client",
    sortOrder: 55,
    defaults: {
      subject: "Shipping for your order #{{orderRef}}",
      heading: "Your shipping quote is ready",
      body_1: "Dear {{firstName}},\n\nYour piece is almost on its way! Shipping for order {{orderRef}} is {{amount}}. Complete payment and we will send it to you right away.",
      body_2: "",
      cta_label: "Pay shipping",
      cta_link: "{{link}}",
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.ABANDONED_CART,
    label: "RTW — Abandoned bag",
    group: "client",
    sortOrder: 56,
    defaults: {
      subject: "Your pieces are still waiting for you",
      heading: "Still thinking it over?",
      body_1: "Dear {{firstName}},\n\nYou left a few beautiful pieces in your bag, and they are still waiting for you.",
      body_2: "Whenever you are ready, we would love to make them yours.",
      cta_label: "Return to checkout",
      cta_link: "{{link}}",
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.POINTS_EXPIRY,
    label: "Points expiring soon",
    group: "client",
    sortOrder: 58,
    defaults: {
      subject: "Your Prudent Points expire soon",
      heading: "A little reminder about your points",
      body_1: "Dear {{firstName}},\n\nSome of your Prudent Points will expire on {{date}}, and we would hate for you to miss out.",
      body_2: "Use them on something you love before then.",
      cta_label: "Shop now",
      cta_link: `${APP()}/rtw`,
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.REFERRAL_SUCCESS,
    label: "Referral success",
    group: "client",
    sortOrder: 59,
    defaults: {
      subject: "Your referral has joined us — thank you!",
      heading: "Your referral landed",
      body_1: "Dear {{firstName}},\n\nA friend you referred has joined Prudent Gabriel. Thank you for sharing us with someone you love. Prudent Points have been added to your account.",
      body_2: "",
      cta_label: "View points",
      cta_link: `${APP()}/account`,
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.JOB_APPLICATION_CONFIRMATION,
    label: "Job application received (applicant)",
    group: "client",
    sortOrder: 60,
    defaults: {
      subject: "Thank you for applying — {{outfitName}}",
      heading: "We have your application",
      body_1: "Dear {{firstName}},\n\nThank you for your interest in joining Prudent Gabriel and for applying for {{outfitName}}. Our team will review your application with care and be in touch.",
      body_2: "",
      cta_label: "",
      cta_link: "",
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.JOB_APPLICATION_STATUS,
    label: "Job application status (applicant)",
    group: "client",
    sortOrder: 61,
    defaults: {
      subject: "Update on your application — {{outfitName}}",
      heading: "An update on your application",
      body_1: "Dear {{firstName}},\n\nThank you for your patience. There is an update on your application for {{outfitName}}.",
      body_2: "",
      cta_label: "",
      cta_link: "",
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.CONSULTATION_ENQUIRY_RECEIVED,
    label: "Consultation enquiry received",
    group: "client",
    lane: "consult",
    sortOrder: 20,
    signOff: { line: "With love and anticipation,", team: "The Prudent Gabriel Team" },
    defaults: {
      subject: "Thank you for choosing Prudent Gabriel, {{firstName}}",
      heading: "Thank you for choosing Prudent Gabriel",
      body_1: "Dear {{firstName}},\n\nThank you for choosing the Prudent Gabriel brand. We are truly delighted and excited to be part of your journey in bringing your dream dress to life.\n\nWe understand that your dress is more than just an outfit; it is a reflection of your personality, your story, and the special moment you are preparing for. We do not take the trust you have placed in us lightly, and we are committed to making this experience as beautiful and seamless as the dress itself.\n\nFrom our consultation to design development, fabric selection, fittings, and final delivery, we will work closely with you to understand your vision, guide you where necessary, and ensure that every detail is thoughtfully considered.",
      body_2: "You can expect clear communication, transparency throughout the process, and a collaborative experience where your concerns are heard, your decisions are respected, and you are kept informed at every important stage.\n\nOur commitment is to approach your dress with the utmost care, craftsmanship, and attention to detail, working diligently to bring your vision to life in a way that reflects the beauty and intention behind it.\n\nWe cannot wait to begin this journey with you and create something truly special.\n\nWelcome to Prudent Gabriel, where your vision meets thoughtful craftsmanship.",
      cta_label: "",
      cta_link: "",
      footer_note: "Reference {{enquiryRef}}. Nothing is booked or charged yet; we will email you once we have reviewed your enquiry.",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.CONSULTATION_ENQUIRY_APPROVED,
    label: "Consultation enquiry approved (booking link)",
    group: "client",
    lane: "consult",
    sortOrder: 21,
    defaults: {
      subject: "Your consultation invitation, {{firstName}}",
      heading: "We would love to meet you",
      body_1: "Dear {{firstName}},\n\nThank you so much for your enquiry. We would be delighted to welcome you for a consultation and begin bringing your vision to life.\n\nPlease choose your consultation and propose three dates that suit you. We will confirm one against Mrs. Prudent's diary.",
      body_2: "This link is personal to you and works until {{expiresOn}}. We cannot wait to meet you.",
      cta_label: "Book your consultation",
      cta_link: "{{link}}",
      footer_note: "Reference {{enquiryRef}}",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.CONSULTATION_ENQUIRY_DECLINED,
    label: "Consultation enquiry declined",
    group: "client",
    lane: "consult",
    sortOrder: 22,
    defaults: {
      subject: "Your enquiry — {{enquiryRef}}",
      heading: "Thank you for thinking of us",
      body_1: "Dear {{firstName}},\n\nThank you so much for thinking of Prudent Gabriel for your special moment. We are truly sorry that we are not able to take this commission, and we did not want to keep you waiting.",
      body_2: "Our ready-to-wear pieces are always open to you, and we would love to dress you another time.",
      cta_label: "Visit the shop",
      cta_link: "{{shopLink}}",
      footer_note: "Reference {{enquiryRef}}",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.CHAT_REPLY,
    label: "Chat reply (when the visitor has left)",
    group: "client",
    sortOrder: 24,
    defaults: {
      subject: "A reply from Prudent Gabriel",
      heading: "{{staffName}} replied to your chat",
      body_1: "Dear {{firstName}},\n\n{{reply}}",
      body_2: "You can reply to this email, or carry on the conversation on the site. We are always happy to hear from you.",
      cta_label: "Continue the conversation",
      cta_link: "{{link}}",
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.CONSULTATION_DAY_BEFORE,
    label: "Consultation reminder (day before)",
    group: "client",
    lane: "consult",
    sortOrder: 23,
    defaults: {
      subject: "Tomorrow is the day — your consultation {{orderRef}}",
      heading: "We cannot wait to see you tomorrow",
      body_1: "Dear {{firstName}},\n\nWe are so looking forward to your consultation {{orderRef}} tomorrow, {{date}} at {{time}} (West Africa Time).",
      body_2: "{{where}}",
      cta_label: "View booking",
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
  {
    key: EMAIL_TEMPLATE_KEYS.BANK_TRANSFER_ADMIN,
    label: "Bank transfer pending (admin)",
    group: "admin",
    sortOrder: 106,
    defaults: {
      subject: "[Bank transfer pending] {{orderRef}}",
      heading: "New bank transfer receipt",
      body_1: "{{firstName}} submitted a transfer receipt for {{orderRef}} — {{amount}}.",
      body_2: "Verify the receipt and confirm the payment in admin.",
      cta_label: "Open admin",
      cta_link: "{{link}}",
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.RTW_FULFILMENT_REFUSED_ADMIN,
    label: "RTW refund required (admin)",
    group: "admin",
    sortOrder: 107,
    defaults: {
      subject: "Refund required — #{{orderRef}}",
      heading: "Paid order could not be fulfilled",
      body_1: "Order {{orderRef}} was paid ({{amount}}) but could not be made as ordered. The order is cancelled.",
      body_2: "Refund the client in the payment provider, then record the refund on the order.",
      cta_label: "Open the order",
      cta_link: "{{link}}",
      footer_note: "",
    },
  },
  {
    key: EMAIL_TEMPLATE_KEYS.ADMIN_CONSULTATION,
    label: "New consultation booking (admin)",
    group: "admin",
    sortOrder: 108,
    defaults: {
      subject: "New consultation booking — {{orderRef}}",
      heading: "New consultation booking",
      body_1: "{{firstName}} ({{email}}) booked a consultation {{orderRef}}.",
      body_2: "",
      cta_label: "Open consultations",
      cta_link: `${APP()}/admin/consultations`,
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
  {
    key: EMAIL_TEMPLATE_KEYS.STAGE_CHANGES_REQUESTED,
    label: "Client requested stage changes",
    group: "staff",
    sortOrder: 202,
    defaults: {
      subject: "Changes requested — {{orderRef}} / {{stageName}}",
      heading: "The client requested changes",
      body_1: "The client requested changes on {{orderRef}} ({{stageName}}).",
      body_2: "{{notes}}",
      cta_label: "Open order",
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

/**
 * Made-to-order and consultation mail is Prudential Atelier; ready-to-wear,
 * account and internal mail is Prudent Gabriel. Templates both houses share
 * (payments, bank transfers) default to main; senders pass the brand.
 */
export function emailBrandForKey(key: EmailTemplateKey): EmailBrand {
  const meta = EMAIL_TEMPLATE_BY_KEY[key];
  if (!meta) return "main";
  const lane = resolveEmailLane(meta);
  return lane === "mto" || lane === "consult" ? "atelier" : "main";
}

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

/** Maps Prisma `BespokeStage` names to admin-editable templates. */
export const BESPOKE_STAGE_EMAIL_KEYS = {
  CONSULTATION_BOOKING: EMAIL_TEMPLATE_KEYS.ATELIER_STAGE_CONSULTATION_BOOKING,
  CONSULTATION_SESSION: EMAIL_TEMPLATE_KEYS.ATELIER_STAGE_CONSULTATION_SESSION,
  INVOICE_ISSUANCE: EMAIL_TEMPLATE_KEYS.ATELIER_STAGE_INVOICE,
  PAYMENT_CONFIRMATION: EMAIL_TEMPLATE_KEYS.ATELIER_STAGE_PAYMENT,
  SKETCHING_CONCEPT: EMAIL_TEMPLATE_KEYS.ATELIER_STAGE_SKETCHING,
  FABRIC_SOURCING: EMAIL_TEMPLATE_KEYS.ATELIER_STAGE_FABRIC,
  DESIGN_APPROVAL: EMAIL_TEMPLATE_KEYS.ATELIER_STAGE_DESIGN_APPROVAL,
  TAILORING: EMAIL_TEMPLATE_KEYS.ATELIER_STAGE_TAILORING,
  FIRST_FITTING: EMAIL_TEMPLATE_KEYS.ATELIER_STAGE_FIRST_FITTING,
  ALTERATIONS: EMAIL_TEMPLATE_KEYS.ATELIER_STAGE_ALTERATIONS,
  BEADING_FINISHING: EMAIL_TEMPLATE_KEYS.ATELIER_STAGE_BEADING,
  FINAL_FITTING: EMAIL_TEMPLATE_KEYS.ATELIER_STAGE_FINAL_FITTING,
  DELIVERY: EMAIL_TEMPLATE_KEYS.ATELIER_STAGE_DELIVERY,
} as const;

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
    stageName: "Design approval",
    collectionCode: "PG-4821",
    pickupName: "Ajah factory",
    pickupAddress: "No. 4 Akinwale Shitu Divine Homes, Thomas Estates, Ajah, Lagos, Nigeria",
    pickupHours: "Monday–Friday 9:00–18:00, Saturday 10:00–16:00",
    size: "M",
    notes: "Please raise the hem by 2cm and soften the neckline.",
  };
}
