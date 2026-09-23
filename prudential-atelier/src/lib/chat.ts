import { ChatContextKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import { PUBLIC_PRODUCT_WHERE } from "@/lib/product-visibility";
import { generateCapabilityToken, hashCapabilityToken, isLegacyCuidToken } from "@/lib/capability-token";
import { CHAT_COOKIE, isAtelierPath } from "@/lib/chat-shared";

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
      return `You're asking about ${ctx.label}. Someone from the house will reply here.`;
    case ChatContextKind.ORDER:
      return `This conversation is about order ${ctx.orderRef}. Someone from the house will reply here.`;
    default:
      return "Thank you for writing. Someone from the house will reply here.";
  }
}
