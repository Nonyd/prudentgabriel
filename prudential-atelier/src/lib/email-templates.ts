/** Built-in defaults when no DB override exists (after reset or before first save). */
export const EMAIL_TEMPLATE_DEFAULTS: Record<string, { subject: string; body: string }> = {
  email_tpl_welcome: {
    subject: "Welcome to Prudent Gabriel",
    body: "Hi {{firstName}},\n\nThank you for joining us. Your referral code is {{referralCode}}.\n\n— Prudent Gabriel",
  },
  email_tpl_order_confirmation: {
    subject: "Order {{orderNumber}} confirmed",
    body: "Hi {{firstName}},\n\nWe've received your order {{orderNumber}}. Thank you for shopping with Prudent Gabriel.\n\n— The Atelier",
  },
  email_tpl_order_shipped: {
    subject: "Your order {{orderNumber}} has shipped",
    body: "Hi {{firstName}},\n\nGreat news — your order is on its way.\n\n— Prudent Gabriel",
  },
  email_tpl_bespoke_confirmation: {
    subject: "We've received your bespoke request",
    body: "Hi {{firstName}},\n\nOur team will review your bespoke enquiry and be in touch shortly.\n\n— Prudent Gabriel",
  },
  email_tpl_password_reset: {
    subject: "Reset your password",
    body: "Hi {{firstName}},\n\nUse the link we sent to reset your password. If you didn't request this, you can ignore this email.\n\n— Prudent Gabriel",
  },
  email_tpl_referral_success: {
    subject: "Your referral reward",
    body: "Hi {{firstName}},\n\nThanks for spreading the word — loyalty points have been added to your account.\n\n— Prudent Gabriel",
  },
  email_tpl_back_in_stock: {
    subject: "{{productName}} is back in stock",
    body: "Hi {{firstName}},\n\nAn item you wanted is available again.\n\n— Prudent Gabriel",
  },
  email_tpl_consultation_pending: {
    subject: "Consultation request received",
    body: "Hi {{firstName}},\n\nWe've received your consultation booking request and will confirm shortly.\n\n— Prudent Gabriel",
  },
  email_tpl_consultation_confirmed: {
    subject: "Your consultation is confirmed",
    body: "Hi {{firstName}},\n\nYour consultation is confirmed. We look forward to seeing you.\n\n— Prudent Gabriel",
  },
  email_tpl_consultation_cancelled: {
    subject: "Consultation update",
    body: "Hi {{firstName}},\n\nYour consultation booking has been cancelled as requested.\n\n— Prudent Gabriel",
  },
};

export const EMAIL_TEMPLATE_KEYS = Object.keys(EMAIL_TEMPLATE_DEFAULTS) as (keyof typeof EMAIL_TEMPLATE_DEFAULTS)[];

export const EMAIL_TEMPLATE_META: Record<
  string,
  { label: string; sortOrder: number }
> = {
  email_tpl_welcome: { label: "Welcome Email", sortOrder: 100 },
  email_tpl_order_confirmation: { label: "Order Confirmation", sortOrder: 101 },
  email_tpl_order_shipped: { label: "Order Shipped", sortOrder: 102 },
  email_tpl_bespoke_confirmation: { label: "Bespoke Confirmation", sortOrder: 103 },
  email_tpl_password_reset: { label: "Password Reset", sortOrder: 104 },
  email_tpl_referral_success: { label: "Referral Success", sortOrder: 105 },
  email_tpl_back_in_stock: { label: "Back In Stock", sortOrder: 106 },
  email_tpl_consultation_pending: { label: "Consultation Pending", sortOrder: 107 },
  email_tpl_consultation_confirmed: { label: "Consultation Confirmed", sortOrder: 108 },
  email_tpl_consultation_cancelled: { label: "Consultation Cancelled", sortOrder: 109 },
};

export function parseTemplateJson(raw: string | undefined | null): { subject: string; body: string } | null {
  if (raw == null || raw.trim() === "") return null;
  try {
    const o = JSON.parse(raw) as { subject?: unknown; body?: unknown };
    return {
      subject: typeof o.subject === "string" ? o.subject : "",
      body: typeof o.body === "string" ? o.body : "",
    };
  } catch {
    return null;
  }
}

export function getEffectiveTemplate(
  key: string,
  dbValue: string | undefined | null,
): { subject: string; body: string } {
  const parsed = parseTemplateJson(dbValue);
  if (parsed) return parsed;
  return EMAIL_TEMPLATE_DEFAULTS[key] ?? { subject: "", body: "" };
}

export function stringifyTemplate(subject: string, body: string): string {
  return JSON.stringify({ subject, body });
}
