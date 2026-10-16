import type { AdminNotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import { isUndeliverableAlertAddress, resolveAdminAlertEmail, resolveHrAlertEmail } from "@/lib/admin-alert-email";

/**
 * Who is told. Prudent Gabriel's SUPER_ADMIN names the people for each kind of
 * house alert, for email and for the bell separately (the BF9 chat pattern,
 * for everything else). Until she names anyone for a kind, its old routing
 * stands: the bell by permission, the email to the alert mailbox. A named
 * person who is no longer an active admin is skipped; if that leaves nobody,
 * the old routing is used for that alert rather than telling no one.
 *
 * Staff work is not routed here: stage handovers, approvals, production
 * unlocks and requisitions go to the people whose job it is.
 */

export type AlertKind =
  | "orders"
  | "payments"
  | "chat"
  | "contact"
  | "consultations"
  | "atelier"
  | "quotations"
  | "reviews"
  | "customers"
  | "careers"
  | "attendance"
  | "reports"
  | "system";

type Fallback = "operational" | "hr";

export type AlertKindDef = {
  id: AlertKind;
  label: string;
  /** What arrives, in her words. */
  about: string;
  /** Bell rows of these types follow this kind. Empty: email only. */
  bell: readonly AdminNotificationType[];
  /** False: bell only. */
  email: boolean;
  /** Where email goes until she names people. */
  fallback: Fallback;
  /** Where the bell goes until she names people. */
  bellDefault?: string;
};

export const ALERT_KINDS: readonly AlertKindDef[] = [
  {
    id: "orders",
    label: "New orders",
    about: "A ready-to-wear order is placed, a fabric runs out, or an order cannot be fulfilled.",
    bell: ["NEW_ORDER", "FABRIC_UNAVAILABLE"],
    email: true,
    fallback: "operational",
    bellDefault: "Everyone who handles orders",
  },
  {
    id: "payments",
    label: "Payment transactions",
    about: "A bank transfer receipt to confirm, a failed payment, or an atelier balance paid.",
    bell: ["BANK_TRANSFER_RECEIPT", "PAYMENT_FAILED"],
    email: true,
    fallback: "operational",
    bellDefault: "Everyone who handles payments or orders",
  },
  {
    id: "chat",
    label: "Live chat",
    about: "A new chat, or one still waiting for a reply. The same choice as Chat → Settings.",
    bell: ["CHAT"],
    email: true,
    fallback: "operational",
    bellDefault: "The content desk",
  },
  {
    id: "contact",
    label: "Contact form enquiries",
    about: "Someone writes through the contact page.",
    bell: ["CONTACT_FORM"],
    email: true,
    fallback: "operational",
    bellDefault: "The content desk",
  },
  {
    id: "consultations",
    label: "Consultation enquiries and bookings",
    about: "A new enquiry or booking, one left waiting, a missing meeting link, a session completed.",
    bell: ["NEW_CONSULTATION", "CONSULTATION_BOOKED_PRUDENT", "CONSULTATION_COMPLETED"],
    email: true,
    fallback: "operational",
    bellDefault: "Everyone who handles consultations",
  },
  {
    id: "atelier",
    label: "Atelier requests",
    about: "A new bespoke request arrives.",
    bell: ["NEW_BESPOKE"],
    email: true,
    fallback: "operational",
    bellDefault: "Everyone who handles the atelier",
  },
  {
    id: "quotations",
    label: "Quotations",
    about: "A client approves a quotation or asks for changes, or a quotation is still unsent.",
    bell: ["QUOTE_APPROVED", "QUOTE_AWAITING", "QUOTE_CHANGES_REQUESTED"],
    email: true,
    fallback: "operational",
    bellDefault: "Everyone who handles quotations",
  },
  {
    id: "reviews",
    label: "Reviews and testimonials",
    about: "A review or testimonial waits for approval.",
    bell: ["REVIEW_PENDING", "TESTIMONIAL_SUBMITTED"],
    email: false,
    fallback: "operational",
    bellDefault: "The content desk",
  },
  {
    id: "customers",
    label: "New clients",
    about: "Someone creates an account.",
    bell: ["NEW_CUSTOMER"],
    email: false,
    fallback: "operational",
    bellDefault: "Everyone who handles clients",
  },
  {
    id: "careers",
    label: "Job applications",
    about: "Someone applies for a role or placement.",
    bell: ["JOB_APPLICATION"],
    email: true,
    fallback: "hr",
    bellDefault: "Everyone who manages staff",
  },
  {
    id: "attendance",
    label: "Late arrivals",
    about: "The morning list of staff who clocked in late or not at all.",
    bell: [],
    email: true,
    fallback: "hr",
  },
  {
    id: "reports",
    label: "Daily and weekly reports",
    about: "The morning summary and the Monday report.",
    bell: [],
    email: true,
    fallback: "operational",
  },
  {
    id: "system",
    label: "System problems",
    about: "Critical site errors, emails that could not be delivered, the email provider refusing to send, the backup drill reminder.",
    bell: ["EMAIL_DEAD", "EMAIL_PROVIDER_AUTH"],
    email: true,
    fallback: "operational",
    bellDefault: "Everyone",
  },
];

/** Not chosen here: the staff whose job it is are told. Shown on the page so nothing looks forgotten. */
export const STAFF_ROUTED_ALERTS: readonly { label: string; goesTo: string }[] = [
  { label: "Stage finished, handed over, approved or sent back", goesTo: "The atelier staff on that commission" },
  { label: "Production unlocked or relocked by a payment", goesTo: "The atelier production desk" },
  { label: "Requisitions waiting", goesTo: "The desk that must approve, fund or buy next" },
  { label: "Emails to a client or a staff member about their own work", goesTo: "That person" },
];

/** Chat keeps its own keys (Chat → Settings writes the same ones). */
export const CHAT_NOTIFY_EMAIL_KEY = "chat_notify_email_user_ids";
export const CHAT_NOTIFY_BELL_KEY = "chat_notify_bell_user_ids";
export const ALERT_RECIPIENTS_KEY = "admin_alert_recipients";

/**
 * Only the Super Admin sets these, through Who is told or Chat → Settings.
 * The generic settings screens neither list nor write them.
 */
const WHO_IS_TOLD_KEYS = new Set([ALERT_RECIPIENTS_KEY, CHAT_NOTIFY_EMAIL_KEY, CHAT_NOTIFY_BELL_KEY]);

export function isWhoIsToldSettingKey(key: string): boolean {
  return WHO_IS_TOLD_KEYS.has(key);
}

export type ChannelChoice = { email: string[] | null; bell: string[] | null };
export type AlertRouting = Record<AlertKind, ChannelChoice>;

const ID = /^[a-z0-9]{10,40}$/i;

export function cleanIdList(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const ids = Array.from(new Set(v.filter((x): x is string => typeof x === "string" && ID.test(x))));
  return ids.length ? ids : null;
}

function parseJson(raw: string | null | undefined): unknown {
  if (!raw?.trim()) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export async function readAlertRouting(): Promise<AlertRouting> {
  const [stored, chatEmail, chatBell] = await Promise.all([
    getSetting(ALERT_RECIPIENTS_KEY),
    getSetting(CHAT_NOTIFY_EMAIL_KEY),
    getSetting(CHAT_NOTIFY_BELL_KEY),
  ]);
  const map = (parseJson(stored) ?? {}) as Record<string, { email?: unknown; bell?: unknown } | undefined>;
  const out = {} as AlertRouting;
  for (const k of ALERT_KINDS) {
    if (k.id === "chat") {
      out.chat = { email: cleanIdList(parseJson(chatEmail)), bell: cleanIdList(parseJson(chatBell)) };
      continue;
    }
    const row = map[k.id];
    out[k.id] = {
      email: k.email ? cleanIdList(row?.email) : null,
      bell: k.bell.length ? cleanIdList(row?.bell) : null,
    };
  }
  return out;
}

/** `mailable` false: their address cannot receive mail (e.g. admin@), so email skips them. */
export type AlertCandidate = { id: string; name: string; email: string; role: string; mailable: boolean };

/** People who may be named: active admins (the same people chat allows). */
export async function alertRecipientCandidates(): Promise<AlertCandidate[]> {
  const users = await prisma.user.findMany({
    where: { isActive: true, role: { in: ["ADMIN", "SUPER_ADMIN"] } },
    select: { id: true, name: true, email: true, role: true },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });
  return users.map((u) => ({
    id: u.id,
    name: u.name?.trim() || u.email,
    email: u.email,
    role: u.role,
    mailable: !isUndeliverableAlertAddress(u.email),
  }));
}

async function usable(ids: string[] | null): Promise<AlertCandidate[]> {
  if (!ids?.length) return [];
  const users = await alertRecipientCandidates();
  return users.filter((u) => ids.includes(u.id));
}

export function alertKindForType(type: AdminNotificationType): AlertKindDef | null {
  return ALERT_KINDS.find((k) => k.bell.includes(type)) ?? null;
}

/** Named people for a bell row of this type, or null for the old permission routing. */
export async function alertBellUserIds(type: AdminNotificationType): Promise<string[] | null> {
  const kind = alertKindForType(type);
  if (!kind) return null;
  const routing = await readAlertRouting();
  const named = await usable(routing[kind.id].bell);
  return named.length ? named.map((u) => u.id) : null;
}

export type AlertEmailTarget = { to: string; userId: string | null };

async function fallbackMailbox(fallback: Fallback): Promise<string | null> {
  return fallback === "hr" ? resolveHrAlertEmail(getSetting) : resolveAdminAlertEmail(getSetting);
}

/**
 * Where an alert email of this kind goes: the named people, else the kind's
 * mailbox. `fallbackTo` replaces the mailbox for a kind with its own inbox
 * (the contact page's CMS inbox).
 */
export async function alertEmailTargets(kind: AlertKind, fallbackTo?: string | null): Promise<AlertEmailTarget[]> {
  const def = ALERT_KINDS.find((k) => k.id === kind)!;
  const routing = await readAlertRouting();
  const named = (await usable(routing[kind].email)).filter((u) => u.mailable);
  if (named.length) return named.map((u) => ({ to: u.email, userId: u.id }));
  const mailbox = fallbackTo?.trim() || (await fallbackMailbox(def.fallback));
  return mailbox ? [{ to: mailbox, userId: null }] : [];
}
