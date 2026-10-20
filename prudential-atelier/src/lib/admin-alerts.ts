import { SettingGroup, SettingType, type AdminNotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { cachedRoleActorPatch, ensurePermissionCache } from "@/lib/permission-cache";
import { hasPermission } from "@/lib/roles";
import { clearSettingCacheKey, getSetting } from "@/lib/settings";
import { isUndeliverableAlertAddress, resolveAdminAlertEmail, resolveHrAlertEmail } from "@/lib/admin-alert-email";

/**
 * Who is told. Prudent Gabriel's SUPER_ADMIN names the people for each kind of
 * house alert, for email and for the bell separately (the BF9 chat pattern,
 * for everything else).
 *
 * Email: this page is the only source of truth. An alert email goes to the
 * people and extra addresses named here and to nobody else: no alert mailbox
 * setting, no env address, no contact inbox. Nobody named means it is not
 * emailed. The addresses those old settings pointed at were carried onto this
 * page once (adoptLegacyMailboxes), so nothing that used to arrive went quiet.
 *
 * Bell: until she names anyone, the bell goes by permission, as before.
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
  /** The old mailbox this kind used to email; carried onto the page once by adoptLegacyMailboxes. */
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
    bellDefault: "Everyone who answers chat",
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
/** Set once the old mailboxes have been carried onto Who is told. */
export const ALERT_LEGACY_ADOPTED_KEY = "admin_alert_recipients_adopted";
/** Old places an alert address was set. Read once by adoptLegacyMailboxes, then never again. */
export const LEGACY_MAILBOX_KEYS = ["admin_notification_email", "hr_alert_email", "contact_notification_email"] as const;

/**
 * Only the Super Admin sets these, through Who is told. The generic settings
 * screens neither list nor write them, nor the retired mailbox settings.
 */
const WHO_IS_TOLD_KEYS = new Set<string>([
  ALERT_RECIPIENTS_KEY,
  ALERT_LEGACY_ADOPTED_KEY,
  CHAT_NOTIFY_EMAIL_KEY,
  CHAT_NOTIFY_BELL_KEY,
  ...LEGACY_MAILBOX_KEYS,
  // Not an alert, but likewise kept off the generic screens: Atelier → Measurement fields writes it.
  "atelier_measurement_fields",
]);

export function isWhoIsToldSettingKey(key: string): boolean {
  return WHO_IS_TOLD_KEYS.has(key);
}

/** `addresses`: extra email addresses that are not a portal user (an inbox). */
export type ChannelChoice = { email: string[] | null; bell: string[] | null; addresses: string[] | null };
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

const EMAIL = /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/;

/** Lower-cased, de-duplicated, deliverable addresses; null when none. */
export function cleanAddressList(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const out = Array.from(
    new Set(
      v
        .filter((x): x is string => typeof x === "string")
        .map((x) => x.trim().toLowerCase())
        .filter((x) => EMAIL.test(x) && !isUndeliverableAlertAddress(x)),
    ),
  );
  return out.length ? out : null;
}

export type StoredRow = { email?: string[] | null; bell?: string[] | null; addresses?: string[] | null };

export async function readStoredMap(): Promise<Record<string, StoredRow>> {
  const parsed = parseJson(await getSetting(ALERT_RECIPIENTS_KEY));
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, StoredRow>) : {};
}

export async function writeSetting(key: string, value: string, label: string, updatedBy: string) {
  await prisma.siteSetting.upsert({
    where: { key },
    create: { key, value, label, type: SettingType.TEXT, group: SettingGroup.NOTIFICATIONS, isPublic: false, sortOrder: 60, updatedBy },
    update: { value, updatedBy },
  });
  clearSettingCacheKey(key);
}

export async function readAlertRouting(): Promise<AlertRouting> {
  await adoptLegacyMailboxes();
  const [map, chatEmail, chatBell] = await Promise.all([
    readStoredMap(),
    getSetting(CHAT_NOTIFY_EMAIL_KEY),
    getSetting(CHAT_NOTIFY_BELL_KEY),
  ]);
  const out = {} as AlertRouting;
  for (const k of ALERT_KINDS) {
    const row = map[k.id];
    const addresses = k.email ? cleanAddressList(row?.addresses) : null;
    if (k.id === "chat") {
      out.chat = { email: cleanIdList(parseJson(chatEmail)), bell: cleanIdList(parseJson(chatBell)), addresses };
      continue;
    }
    out[k.id] = {
      email: k.email ? cleanIdList(row?.email) : null,
      bell: k.bell.length ? cleanIdList(row?.bell) : null,
      addresses,
    };
  }
  return out;
}

let adopted = false;

/**
 * One time: every alert kind that nobody was named for used to email an old
 * mailbox (Email settings' admin notification address, the HR alert address,
 * the contact page's inbox, or an env address). Put that address on Who is told,
 * as the person who owns it when one does, else as an extra address, so the
 * page shows everyone who was being told. After this, those old settings are
 * never read again.
 */
export async function adoptLegacyMailboxes(): Promise<void> {
  if (adopted) return;
  if ((await getSetting(ALERT_LEGACY_ADOPTED_KEY)) === "1") {
    adopted = true;
    return;
  }
  const [map, chatEmail, operational, hr, contactInbox, candidates] = await Promise.all([
    readStoredMap(),
    getSetting(CHAT_NOTIFY_EMAIL_KEY),
    resolveAdminAlertEmail(getSetting),
    resolveHrAlertEmail(getSetting),
    getSetting("contact_notification_email"),
    alertRecipientCandidates(),
  ]);
  const notes: string[] = [];
  for (const k of ALERT_KINDS) {
    if (!k.email) continue;
    const row = map[k.id] ?? {};
    const named = k.id === "chat" ? cleanIdList(parseJson(chatEmail)) : cleanIdList(row.email);
    if (named?.length || cleanAddressList(row.addresses)?.length) continue;
    const contact = k.id === "contact" ? cleanAddressList([contactInbox])?.[0] : undefined;
    const legacy = contact ?? cleanAddressList([k.fallback === "hr" ? hr : operational])?.[0];
    if (!legacy) continue;
    const owner = candidates.find((c) => c.mailable && c.email.toLowerCase() === legacy && eligibleFor(k.id, c));
    if (owner && k.id === "chat") {
      await writeSetting(CHAT_NOTIFY_EMAIL_KEY, JSON.stringify([owner.id]), "Chat: who is emailed (user ids)", "who-is-told-adopt");
    } else if (owner) {
      map[k.id] = { ...row, email: [owner.id] };
    } else {
      map[k.id] = { ...row, addresses: [legacy] };
    }
    notes.push(`${k.label} → ${legacy}`);
  }
  await writeSetting(ALERT_RECIPIENTS_KEY, JSON.stringify(map), "Who is told: named recipients per alert", "who-is-told-adopt");
  await writeSetting(ALERT_LEGACY_ADOPTED_KEY, "1", "Who is told: old alert mailboxes carried over", "who-is-told-adopt");
  adopted = true;
  if (notes.length) {
    await prisma.activityLog
      .create({ data: { action: "UPDATE", module: "settings", description: `Who is told: old alert addresses carried over (${notes.join("; ")})` } })
      .catch(() => undefined);
  }
}

/**
 * `mailable` false: their address cannot receive mail (e.g. admin@), so email skips them.
 * `office`: anyone in Users & Roles except Staff (admins, managers, officers, and any
 *   role added later), who may be named for any alert, chat included.
 * `chat`: holds Live chat (by role or a personal grant); a Staff member with Live chat
 *   may still be named for chat.
 */
export type AlertCandidate = {
  id: string;
  name: string;
  email: string;
  role: string;
  mailable: boolean;
  office: boolean;
  chat: boolean;
};

/**
 * People who may be named: every active portal user except Staff, for every alert,
 * plus a Staff member who holds Live chat, for chat only.
 */
export async function alertRecipientCandidates(): Promise<AlertCandidate[]> {
  await ensurePermissionCache();
  const users = await prisma.user.findMany({
    where: { isActive: true, role: { not: "CUSTOMER" } },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      userPermissions: { select: { permission: true, mode: true } },
    },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });
  return users
    .map((u) => {
      const office = u.role !== "STAFF";
      const chat = hasPermission(u.role, "chat", {
        email: u.email,
        grants: u.userPermissions.filter((p) => p.mode === "GRANT").map((p) => p.permission),
        revokes: u.userPermissions.filter((p) => p.mode === "REVOKE").map((p) => p.permission),
        ...cachedRoleActorPatch(u.role),
      });
      return {
        id: u.id,
        name: u.name?.trim() || u.email,
        email: u.email,
        role: u.role,
        mailable: !isUndeliverableAlertAddress(u.email),
        office,
        chat,
      };
    })
    .filter((u) => u.office || u.chat);
}

/** May this person be named for this kind of alert? */
export function eligibleFor(kind: AlertKind, c: AlertCandidate): boolean {
  return c.office || (kind === "chat" && c.chat);
}

async function usable(kind: AlertKind, ids: string[] | null): Promise<AlertCandidate[]> {
  if (!ids?.length) return [];
  const users = await alertRecipientCandidates();
  return users.filter((u) => ids.includes(u.id) && eligibleFor(kind, u));
}

export function alertKindForType(type: AdminNotificationType): AlertKindDef | null {
  return ALERT_KINDS.find((k) => k.bell.includes(type)) ?? null;
}

/** Named people for a bell row of this type, or null for the old permission routing. */
export async function alertBellUserIds(type: AdminNotificationType): Promise<string[] | null> {
  const kind = alertKindForType(type);
  if (!kind) return null;
  const routing = await readAlertRouting();
  const named = await usable(kind.id, routing[kind.id].bell);
  return named.length ? named.map((u) => u.id) : null;
}

export type AlertEmailTarget = { to: string; userId: string | null };

/**
 * Where an alert email of this kind goes: exactly the people and addresses
 * named on Who is told. Nobody named: nobody is emailed.
 */
export async function alertEmailTargets(kind: AlertKind): Promise<AlertEmailTarget[]> {
  const routing = await readAlertRouting();
  const named = (await usable(kind, routing[kind].email)).filter((u) => u.mailable);
  const out: AlertEmailTarget[] = named.map((u) => ({ to: u.email.trim().toLowerCase(), userId: u.id }));
  for (const to of routing[kind].addresses ?? []) {
    if (!out.some((t) => t.to === to)) out.push({ to, userId: null });
  }
  return out;
}
