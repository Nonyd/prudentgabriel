/** BA5 chat — client-safe constants and helpers (no server imports). */

/** Essential cookie holding the visitor's conversation token (httpOnly). */
export const CHAT_COOKIE = "pg_chat";

export const CHAT_MESSAGE_MAX = 2000;

/** The commission journey: chat acknowledges, then hands over the enquiry form. */
export function isAtelierPath(path: string): boolean {
  return /^\/(atelier|bridal|bespoke|consultation)(\/|$)/.test(path);
}

export type ChatAttachmentView = { id: string; mime: string; name: string; bytes: number };

export type ChatMessageView = {
  id: string;
  author: "VISITOR" | "STAFF" | "SYSTEM";
  staffName: string | null;
  /** The words as they stand now (the latest edit, or what was sent). */
  body: string;
  createdAt: string;
  /** BF8: set when edited; the original is kept for the house. */
  editedAt: string | null;
  attachments: ChatAttachmentView[];
};

export const CHAT_CLOSED_MESSAGE = "Chat is not open at the moment. Please use the contact page.";

/** BF7: images and PDF, nothing else. SVG is excluded on purpose (script from our own origin). */
export const CHAT_ATTACHMENT_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf";
export const CHAT_ATTACHMENT_MIMES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;

/** BF3: the greeting, from the house — a bare greeting reads as the visitor addressing support. */
export const CHAT_GREETING_FROM = "Prudent Support";
export const CHAT_GREETING_TEXT = "Hello — how may I assist you today?";
/** Per visit (sessionStorage): dismissed means dismissed on every page until the tab closes. */
export const CHAT_GREETING_SESSION_KEY = "pg_chat_greeting";

/** What the widget needs before it shows anything: is anyone there, and the knobs. */
export type ChatStatusView = {
  /** Switched on (BA5: on, with a retention decision). */
  enabled: boolean;
  /** Inside the schedule (BF2). Out of hours the widget still takes a message. */
  live: boolean;
  /** Next opening, ISO, computed from the schedule; null when none is set. */
  opensAt: string | null;
  /** "Monday at 9:00", Lagos time. */
  opensLabel: string | null;
  /** Seconds before the greeting slides in; null when switched off. */
  greetingDelaySec: number | null;
  /** BF8: how long a sent line may be corrected. */
  editWindowSec: number;
  /** Signed in: she types nothing, the thread attaches to her account (BF4). */
  account: { name: string } | null;
};

export type ChatContact = { email: string; phone: null } | { email: null; phone: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * BF4: one way to reply — an email or a phone number, typed in one field.
 * A phone keeps a leading + and its digits (7 to 15 of them, E.164's range).
 */
export function parseChatContact(raw: string | null | undefined): ChatContact | null {
  const v = raw?.trim() ?? "";
  if (!v || v.length > 200) return null;
  if (v.includes("@")) return EMAIL.test(v) ? { email: v.toLowerCase(), phone: null } : null;
  if (!/^\+?[\d\s().-]+$/.test(v)) return null;
  const digits = v.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  return { email: null, phone: `${v.trim().startsWith("+") ? "+" : ""}${digits}` };
}

/** "We'll reply by email" or by phone — whichever she gave. */
export function replyRoute(contact: { email: string | null; phone: string | null }): string {
  return contact.email ? `by email (${contact.email})` : contact.phone ? `on ${contact.phone}` : "as soon as we can";
}
