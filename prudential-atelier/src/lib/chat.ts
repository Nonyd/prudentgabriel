import { ChatContextKind, type ChatAuthor } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import { PUBLIC_PRODUCT_WHERE } from "@/lib/product-visibility";
import { generateCapabilityToken, hashCapabilityToken, isLegacyCuidToken } from "@/lib/capability-token";
import { CHAT_COOKIE, isAtelierPath, replyRoute, type ChatMessageView } from "@/lib/chat-shared";
import {
  describeOpening,
  isOpenAt,
  nextOpening,
  parseClosedDates,
  parseSchedule,
  type WeeklySchedule,
} from "@/lib/chat-hours";

/**
 * Slice BA5 — first-party live chat. General support: the shop, an order,
 * sizing, shipping. It never screens a commission and never quotes a gown;
 * a conversation started on the atelier journey is handed the enquiry form.
 *
 * - Name and email are required before a conversation starts.
 * - Context is kept for the conversation — the page it started on and the
 *   piece or order it concerns — never as a browsing trail.
 * - The visitor holds one essential httpOnly cookie (the conversation token).
 * - Conversations are personal data: chat cannot be switched on until the
 *   house sets a retention period, and the chat-retention job enforces it.
 */

export const CHAT_ENABLED_KEY = "chat_enabled";
export const CHAT_RETENTION_DAYS_KEY = "chat_retention_days";
/** Who answers and when, written by the house; shown to the visitor. */
export const CHAT_HOURS_KEY = "chat_hours_text";

/** A reply is emailed when the visitor has not looked at the thread for this long. */
export const CHAT_AWAY_MS = 2 * 60 * 1000;
/** The cookie lasts at most this long (and never longer than retention). */
const CHAT_COOKIE_MAX_DAYS = 30;

/** Stored value meaning "keep indefinitely" — an explicit decision, not an empty field. */
export const CHAT_RETENTION_KEEP = "keep";

/**
 * The house's retention decision:
 * - unset: nobody has decided — chat cannot be switched on;
 * - keep: kept indefinitely, by decision (the house's answer, 23 Sep 2026);
 * - days: deleted that many days after the last message.
 */
export type ChatRetention = { kind: "unset" } | { kind: "keep" } | { kind: "days"; days: number };

export function parseChatRetention(raw: string | null | undefined): ChatRetention {
  const v = raw?.trim().toLowerCase();
  if (!v) return { kind: "unset" };
  if (v === CHAT_RETENTION_KEEP) return { kind: "keep" };
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? { kind: "days", days: n } : { kind: "unset" };
}

export async function getChatRetention(): Promise<ChatRetention> {
  return parseChatRetention(await getSetting(CHAT_RETENTION_DAYS_KEY));
}

/** Days before deletion, or null (unset or kept indefinitely). */
export async function getChatRetentionDays(): Promise<number | null> {
  const r = await getChatRetention();
  return r.kind === "days" ? r.days : null;
}

/** Open only when switched on AND a retention decision exists — never by default. */
export async function isChatOpen(): Promise<boolean> {
  if ((await getSetting(CHAT_ENABLED_KEY)) !== "true") return false;
  return (await getChatRetention()).kind !== "unset";
}

export async function getChatHoursText(): Promise<string> {
  return (await getSetting(CHAT_HOURS_KEY))?.trim() ?? "";
}

export async function chatCookieMaxAgeSec(): Promise<number> {
  const days = Math.min(CHAT_COOKIE_MAX_DAYS, (await getChatRetentionDays()) ?? CHAT_COOKIE_MAX_DAYS);
  return days * 24 * 60 * 60;
}

export function issueChatToken(maxAgeSec: number, now = new Date()) {
  const t = generateCapabilityToken();
  return {
    raw: t.raw,
    data: { publicToken: t.hash, publicTokenExpiresAt: new Date(now.getTime() + maxAgeSec * 1000) },
  };
}

export function chatCookieOptions(maxAgeSec: number) {
  return {
    name: CHAT_COOKIE,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSec,
  };
}

/** The visitor's open conversation from the cookie value, or null. */
export async function findChatByToken(raw: string | undefined | null) {
  const t = raw?.trim();
  if (!t || t.length < 32 || isLegacyCuidToken(t)) return null;
  const convo = await prisma.chatConversation.findUnique({ where: { publicToken: hashCapabilityToken(t) } });
  if (!convo) return null;
  if (!convo.publicTokenExpiresAt || convo.publicTokenExpiresAt.getTime() < Date.now()) return null;
  return convo;
}

const ORDER_REF = /^[A-Z0-9][A-Z0-9-]{3,39}$/i;

export type ResolvedChatContext = {
  kind: ChatContextKind;
  path: string;
  label: string | null;
  productId: string | null;
  orderRef: string | null;
};

/**
 * Where the conversation started, from the page path (no query kept) plus an
 * order reference the page supplies. Resolved on the server: a product is
 * named only if it is published.
 */
export async function resolveChatContext(input: {
  path: string;
  orderRef?: string | null;
  userId?: string | null;
}): Promise<ResolvedChatContext> {
  const path = (input.path.split(/[?#]/)[0] || "/").slice(0, 200);
  const ref = input.orderRef?.trim().toUpperCase();
  const orderRef = ref && ORDER_REF.test(ref) ? ref : null;
  const base = { path, label: null, productId: null, orderRef: null };

  if (isAtelierPath(path)) return { ...base, kind: ChatContextKind.ATELIER };

  const piece = path.match(/^\/shop\/([a-z0-9-]+)\/?$/i);
  if (piece) {
    const product = await prisma.product.findFirst({
      where: { ...PUBLIC_PRODUCT_WHERE, slug: piece[1] },
      select: { id: true, name: true },
    });
    if (product) return { ...base, kind: ChatContextKind.PIECE, label: product.name, productId: product.id };
    return { ...base, kind: ChatContextKind.SHOP };
  }

  // /account/orders/<id>: named only for the signed-in owner, by its order number.
  const accountOrder = path.match(/^\/account\/orders\/([a-z0-9]{10,40})\/?$/i);
  if (accountOrder && input.userId) {
    const order = await prisma.order.findFirst({
      where: { id: accountOrder[1], userId: input.userId },
      select: { orderNumber: true },
    });
    if (order) return { ...base, kind: ChatContextKind.ORDER, label: `Order ${order.orderNumber}`, orderRef: order.orderNumber };
  }
  if (/^\/(track|account)(\/|$)/.test(path)) {
    if (orderRef) return { ...base, kind: ChatContextKind.ORDER, label: `Order ${orderRef}`, orderRef };
    return { ...base, kind: ChatContextKind.GENERAL };
  }

  if (/^\/(shop|cart|checkout|rtw|kids|collections)(\/|$)/.test(path)) return { ...base, kind: ChatContextKind.SHOP };
  return { ...base, kind: ChatContextKind.GENERAL };
}

/** The house's opening line for a conversation, by context. Never a price. */
export function openingLine(ctx: ResolvedChatContext, appUrl: string): string {
  switch (ctx.kind) {
    case ChatContextKind.ATELIER:
      return (
        "Thank you for thinking of the atelier. Every commission begins with a short enquiry, so Mrs. Prudent's team " +
        `can prepare for you: ${appUrl}/consultation. We can't quote or book a commission in chat, but we're glad to ` +
        "help with anything else here."
      );
    case ChatContextKind.PIECE:
      return `You're asking about ${ctx.label}. Someone from Prudent Gabriel will reply here.`;
    case ChatContextKind.ORDER:
      return `This conversation is about order ${ctx.orderRef}. Someone from Prudent Gabriel will reply here.`;
    default:
      return "Thank you for writing. Someone from Prudent Gabriel will reply here.";
  }
}

// ── Slice BF: staffing, hours, and the knobs the house sets ────────────────

/** BF2: the weekly schedule (JSON, Lagos time) and the dates the house is closed (JSON list). */
export const CHAT_SCHEDULE_KEY = "chat_schedule";
export const CHAT_CLOSED_DATES_KEY = "chat_closed_dates";
/** BF3: seconds before the greeting slides in, or "off". */
export const CHAT_GREETING_DELAY_KEY = "chat_greeting_delay_sec";
/** BF8: seconds a sent line may be corrected. */
export const CHAT_EDIT_WINDOW_KEY = "chat_edit_window_sec";
/** BF6: minutes unanswered before the recipients are told again, then before she is told nobody is free. */
export const CHAT_RENOTIFY_MIN_KEY = "chat_unanswered_renotify_min";
export const CHAT_GIVEUP_MIN_KEY = "chat_unanswered_giveup_min";
/** BF5: minutes without a sign from the handler before the conversation returns to the pool. */
export const CHAT_CLAIM_IDLE_MIN_KEY = "chat_claim_idle_min";
/** BF9: who is told, by user id (JSON lists), for email and the bell separately. */
export const CHAT_NOTIFY_EMAIL_KEY = "chat_notify_email_user_ids";
export const CHAT_NOTIFY_BELL_KEY = "chat_notify_bell_user_ids";

/** Defaults used until the house changes them; every one is a setting, none a constant in the code paths. */
export const CHAT_DEFAULTS = {
  greetingDelaySec: 15,
  editWindowSec: 30,
  renotifyMin: 3,
  giveUpMin: 10,
  claimIdleMin: 10,
} as const;

function intSetting(raw: string | null | undefined, fallback: number, min: number, max: number): number {
  const n = Number(raw?.trim());
  return raw?.trim() && Number.isInteger(n) && n >= min && n <= max ? n : fallback;
}

export function parseUserIdList(raw: string | null | undefined): string[] | null {
  if (!raw?.trim()) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return null;
    const ids = Array.from(new Set(v.filter((x): x is string => typeof x === "string" && /^[a-z0-9]{10,40}$/i.test(x))));
    return ids.length ? ids : null;
  } catch {
    return null;
  }
}

export type ChatStaffing = {
  schedule: WeeklySchedule | null;
  closedDates: string[];
  /** Null: the greeting is switched off. */
  greetingDelaySec: number | null;
  editWindowSec: number;
  renotifyMin: number;
  giveUpMin: number;
  claimIdleMin: number;
  /** Null: nobody named yet — BA5's routing (the contact desk) still applies. */
  notifyEmailUserIds: string[] | null;
  notifyBellUserIds: string[] | null;
};

export async function getChatStaffing(): Promise<ChatStaffing> {
  const [schedule, closed, greet, edit, renotify, giveUp, idle, email, bell] = await Promise.all([
    getSetting(CHAT_SCHEDULE_KEY),
    getSetting(CHAT_CLOSED_DATES_KEY),
    getSetting(CHAT_GREETING_DELAY_KEY),
    getSetting(CHAT_EDIT_WINDOW_KEY),
    getSetting(CHAT_RENOTIFY_MIN_KEY),
    getSetting(CHAT_GIVEUP_MIN_KEY),
    getSetting(CHAT_CLAIM_IDLE_MIN_KEY),
    getSetting(CHAT_NOTIFY_EMAIL_KEY),
    getSetting(CHAT_NOTIFY_BELL_KEY),
  ]);
  const renotifyMin = intSetting(renotify, CHAT_DEFAULTS.renotifyMin, 1, 240);
  return {
    schedule: parseSchedule(schedule),
    closedDates: parseClosedDates(closed),
    greetingDelaySec: greet?.trim().toLowerCase() === "off" ? null : intSetting(greet, CHAT_DEFAULTS.greetingDelaySec, 0, 600),
    editWindowSec: intSetting(edit, CHAT_DEFAULTS.editWindowSec, 0, 600),
    renotifyMin,
    // The second period always ends after the first.
    giveUpMin: Math.max(renotifyMin + 1, intSetting(giveUp, CHAT_DEFAULTS.giveUpMin, 2, 480)),
    claimIdleMin: intSetting(idle, CHAT_DEFAULTS.claimIdleMin, 1, 240),
    notifyEmailUserIds: parseUserIdList(email),
    notifyBellUserIds: parseUserIdList(bell),
  };
}

export type ChatAvailability = { enabled: boolean; live: boolean; opensAt: Date | null; opensLabel: string | null };

/**
 * BF2: switched on (BA5), and inside the schedule. Fails closed: no schedule,
 * or one that cannot be read, is closed. Out of hours the widget still takes a
 * message; it is just not live.
 */
export async function getChatAvailability(now = new Date(), staffing?: ChatStaffing): Promise<ChatAvailability> {
  const enabled = await isChatOpen();
  const s = staffing ?? (await getChatStaffing());
  const live = enabled && isOpenAt(s.schedule, s.closedDates, now);
  const opensAt = live ? null : nextOpening(s.schedule, s.closedDates, now);
  return { enabled, live, opensAt, opensLabel: describeOpening(opensAt, now) };
}

/** The house's line when it is closed: plain, with the next opening computed from the schedule. */
export function closedLine(opensLabel: string | null, contact: { email: string | null; phone: string | null }): string {
  const when = opensLabel ? `We open again ${opensLabel} (Lagos time).` : "We'll be back as soon as we can.";
  return `Prudent Gabriel is closed right now. ${when} We have your message and will reply ${replyRoute(contact)}.`;
}

/** BF6: open, but nobody came. Honest, then it behaves like an out-of-hours conversation. */
export function nobodyFreeLine(contact: { email: string | null; phone: string | null }): string {
  return `Sorry — nobody is free to answer right now. We have your message and will reply ${replyRoute(contact)}.`;
}

/** BF5: the name a stranger sees. A display name, else the first name; never a surname. */
export function staffChatName(user: { displayName?: string | null; name?: string | null }): string {
  return user.displayName?.trim() || user.name?.trim().split(/\s+/)[0] || "Prudent Gabriel";
}

type MessageRow = {
  id: string;
  author: ChatAuthor;
  staffName: string | null;
  body: string;
  createdAt: Date;
  revisions?: { body: string; createdAt: Date }[];
  attachments?: { id: string; mime: string; originalName: string; bytes: number }[];
};

/** What the visitor's panel shows: the latest words, an "edited" mark, no originals, no internal lines. */
export function chatMessageView(m: MessageRow): ChatMessageView {
  const last = m.revisions?.length ? m.revisions[m.revisions.length - 1] : null;
  return {
    id: m.id,
    author: m.author,
    staffName: m.staffName,
    body: last?.body ?? m.body,
    createdAt: m.createdAt.toISOString(),
    editedAt: last ? last.createdAt.toISOString() : null,
    attachments: (m.attachments ?? []).map((a) => ({ id: a.id, mime: a.mime, name: a.originalName, bytes: a.bytes })),
  };
}

/** Prisma include for a thread: edits oldest first, files. */
export const CHAT_MESSAGE_INCLUDE = {
  revisions: { orderBy: { createdAt: "asc" as const }, select: { body: true, createdAt: true } },
  attachments: { select: { id: true, mime: true, originalName: true, bytes: true } },
};

/**
 * BF8: may this line still be corrected? Both sides follow the same rule —
 * the house quietly changing what it told a customer is a liability, not a
 * convenience. Null means yes; otherwise the reason (all answered 409).
 * - Only your own line: a visitor hers, a member of the house her own.
 * - Within the window (a setting, 30 seconds by default).
 * - Never once the other side has replied, even inside the window: editing a
 *   line someone has already answered makes the transcript nonsense. The
 *   house's automatic lines (SYSTEM) are not a reply.
 */
export function editRefusal(p: {
  message: { author: ChatAuthor; staffUserId: string | null; createdAt: Date };
  editor: { author: "VISITOR" } | { author: "STAFF"; userId: string };
  /** Authors of messages after this one, internal lines excluded. */
  laterAuthors: ChatAuthor[];
  windowSec: number;
  now?: Date;
}): string | null {
  const now = p.now ?? new Date();
  if (p.message.author !== p.editor.author) return "Only your own message can be edited.";
  if (p.editor.author === "STAFF" && p.message.staffUserId !== p.editor.userId) return "Only your own message can be edited.";
  if (now.getTime() - p.message.createdAt.getTime() > p.windowSec * 1000) {
    return `A message can be edited for ${p.windowSec} seconds after it is sent.`;
  }
  const other = p.editor.author === "VISITOR" ? "STAFF" : "VISITOR";
  if (p.laterAuthors.includes(other as ChatAuthor)) return "It has already been answered, so it can no longer be edited.";
  return null;
}
