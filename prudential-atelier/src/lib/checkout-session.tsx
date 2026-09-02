import { render } from "@react-email/render";
import React from "react";
import { EMAIL_PRIORITY_MARKETING } from "@/lib/email-priority";
import { normalizeEmail, suppressedEmailSet } from "@/lib/email-consent";
import { prisma } from "@/lib/prisma";
import { queueEmail } from "@/lib/email-outbox";
import { getPublicAppUrl } from "@/lib/app-url";
import { primeEmailBranding } from "@/lib/email-branding";
import { CUSTOMER_HOUSE_NAME } from "@/lib/customer-email";
import AbandonedCheckoutEmail from "@/emails/AbandonedCheckoutEmail";

export const FIRST_REMINDER_MS = 4 * 60 * 60 * 1000;
export const SECOND_REMINDER_MS = 24 * 60 * 60 * 1000;
export const RECENT_MANUAL_WARN_MS = 4 * 60 * 60 * 1000;
export const MAX_AUTOMATIC_REMINDERS = 2;

export type CheckoutSnapshotLine = {
  id?: string;
  productId: string;
  productName: string;
  productSlug: string;
  variantId: string;
  size: string;
  colorId?: string | null;
  color?: string;
  colorHex?: string;
  imageUrl: string;
  priceNGN: number;
  priceUSD?: number;
  priceGBP?: number;
  quantity: number;
  stock?: number;
  category?: string;
};

export type CheckoutCartSnapshot = {
  lines: CheckoutSnapshotLine[];
  subtotalNGN: number;
};

export function parseCartSnapshot(raw: unknown): CheckoutCartSnapshot {
  if (!raw || typeof raw !== "object") return { lines: [], subtotalNGN: 0 };
  const o = raw as Record<string, unknown>;
  const linesIn = Array.isArray(o.lines) ? o.lines : Array.isArray(raw) ? raw : [];
  const lines: CheckoutSnapshotLine[] = [];
  for (const item of linesIn) {
    if (!item || typeof item !== "object") continue;
    const l = item as Record<string, unknown>;
    const productId = String(l.productId ?? "");
    const variantId = String(l.variantId ?? "");
    const productName = String(l.productName ?? l.name ?? "Piece");
    const qty = Number(l.quantity) || 0;
    if (!productId || !variantId || qty < 1) continue;
    lines.push({
      id: typeof l.id === "string" ? l.id : `${variantId}-${l.colorId ?? "none"}`,
      productId,
      productName,
      productSlug: String(l.productSlug ?? ""),
      variantId,
      size: String(l.size ?? ""),
      colorId: typeof l.colorId === "string" ? l.colorId : null,
      color: typeof l.color === "string" ? l.color : undefined,
      colorHex: typeof l.colorHex === "string" ? l.colorHex : undefined,
      imageUrl: String(l.imageUrl ?? ""),
      priceNGN: Number(l.priceNGN) || 0,
      priceUSD: Number(l.priceUSD) || 0,
      priceGBP: Number(l.priceGBP) || 0,
      quantity: qty,
      stock: typeof l.stock === "number" ? l.stock : undefined,
      category: typeof l.category === "string" ? l.category : undefined,
    });
  }
  const subtotalNGN =
    typeof o.subtotalNGN === "number"
      ? o.subtotalNGN
      : lines.reduce((s, l) => s + l.priceNGN * l.quantity, 0);
  return { lines, subtotalNGN };
}

export function snapshotValueNGN(raw: unknown): number {
  return parseCartSnapshot(raw).subtotalNGN;
}

export async function allSnapshotItemsOutOfStock(raw: unknown): Promise<boolean> {
  const { lines } = parseCartSnapshot(raw);
  if (lines.length === 0) return true;
  const variantIds = Array.from(new Set(lines.map((l) => l.variantId)));
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds } },
    select: { id: true, stock: true, product: { select: { inStock: true } } },
  });
  const byId = new Map(variants.map((v) => [v.id, v]));
  return lines.every((l) => {
    const v = byId.get(l.variantId);
    if (!v) return true;
    return v.stock < 1 || !v.product.inStock;
  });
}

export async function upsertCheckoutSession(input: {
  id?: string | null;
  email: string;
  userId?: string | null;
  cartSnapshot: CheckoutCartSnapshot;
  currency: string;
  furthestStep: number;
}): Promise<{ id: string }> {
  const email = normalizeEmail(input.email);
  const furthestStep = Math.min(3, Math.max(1, Math.floor(input.furthestStep) || 1));
  const currency = (input.currency || "NGN").slice(0, 8);
  const data = {
    email,
    userId: input.userId ?? null,
    cartSnapshot: input.cartSnapshot as object,
    currency,
    furthestStep,
    lastActiveAt: new Date(),
  };

  if (input.id) {
    const existing = await prisma.checkoutSession.findUnique({ where: { id: input.id } });
    if (existing && !existing.recoveredAt) {
      const nextStep = Math.max(existing.furthestStep, furthestStep);
      await prisma.checkoutSession.update({
        where: { id: existing.id },
        data: { ...data, furthestStep: nextStep },
      });
      return { id: existing.id };
    }
  }

  const open = await prisma.checkoutSession.findFirst({
    where: { email, recoveredAt: null },
    orderBy: { lastActiveAt: "desc" },
  });
  if (open) {
    const nextStep = Math.max(open.furthestStep, furthestStep);
    await prisma.checkoutSession.update({
      where: { id: open.id },
      data: { ...data, furthestStep: nextStep },
    });
    return { id: open.id };
  }

  const created = await prisma.checkoutSession.create({ data });
  return { id: created.id };
}

export async function markCheckoutSessionsRecovered(params: {
  email: string;
  orderId: string;
  lines: { productId: string; variantId: string | null }[];
}): Promise<number> {
  const email = normalizeEmail(params.email);
  if (!email.includes("@")) return 0;
  const open = await prisma.checkoutSession.findMany({
    where: { email, recoveredAt: null },
  });
  const orderKeys = new Set(
    params.lines.map((l) => `${l.productId}:${l.variantId ?? ""}`),
  );
  let n = 0;
  for (const session of open) {
    const snap = parseCartSnapshot(session.cartSnapshot);
    const match = snap.lines.some((l) => orderKeys.has(`${l.productId}:${l.variantId}`));
    if (!match) continue;
    await prisma.checkoutSession.update({
      where: { id: session.id },
      data: { recoveredAt: new Date(), orderId: params.orderId },
    });
    n += 1;
  }
  return n;
}

export function restoreUrlForToken(token: string): string {
  return `${getPublicAppUrl()}/checkout/restore/${encodeURIComponent(token)}`;
}

function formatPriceLabel(amount: number, currency: string): string {
  const n = Math.round(amount);
  if (currency === "USD") return `$${n.toLocaleString("en-US")}`;
  if (currency === "GBP") return `£${n.toLocaleString("en-GB")}`;
  return `₦${n.toLocaleString("en-NG")}`;
}

export type ReminderKind = 1 | 2 | "manual";

export async function sendAbandonedCheckoutReminder(params: {
  sessionId: string;
  kind: ReminderKind;
  now?: Date;
}): Promise<{ queued: boolean; created: boolean; reason?: string; warning?: string }> {
  const now = params.now ?? new Date();
  const session = await prisma.checkoutSession.findUnique({ where: { id: params.sessionId } });
  if (!session) return { queued: false, created: false, reason: "not_found" };
  if (session.recoveredAt) return { queued: false, created: false, reason: "recovered" };

  if (params.kind === "manual" && session.remindersSent >= MAX_AUTOMATIC_REMINDERS) {
    return { queued: false, created: false, reason: "automatic_cap" };
  }
  if (params.kind !== "manual" && session.remindersSent >= MAX_AUTOMATIC_REMINDERS) {
    return { queued: false, created: false, reason: "automatic_cap" };
  }

  const suppressed = await suppressedEmailSet([session.email]);
  if (suppressed.has(normalizeEmail(session.email))) {
    return { queued: false, created: false, reason: "unsubscribed" };
  }

  if (await allSnapshotItemsOutOfStock(session.cartSnapshot)) {
    return { queued: false, created: false, reason: "out_of_stock" };
  }

  const snap = parseCartSnapshot(session.cartSnapshot);
  if (snap.lines.length === 0) {
    return { queued: false, created: false, reason: "empty" };
  }

  const reminderNumber = params.kind === "manual" ? "manual" : String(params.kind);
  const idempotencyKey = `abandoned-checkout:${session.id}:${reminderNumber}`;

  await primeEmailBranding();
  const firstName = session.email.split("@")[0] || "there";
  const html = await render(
    <AbandonedCheckoutEmail
      firstName={firstName}
      restoreUrl={restoreUrlForToken(session.restoreToken)}
      currencyNote={formatPriceLabel(snap.subtotalNGN, session.currency)}
      lines={snap.lines.map((l) => ({
        name: l.productName,
        quantity: l.quantity,
        imageUrl: l.imageUrl || null,
        priceLabel: formatPriceLabel(l.priceNGN, session.currency),
        size: l.size,
        color: l.color,
      }))}
    />,
  );

  const queued = await queueEmail({
    to: session.email,
    subject: `Your bag is waiting | ${CUSTOMER_HOUSE_NAME}`,
    html,
    template: "abandoned-checkout",
    idempotencyKey,
    relatedType: "CheckoutSession",
    relatedId: session.id,
    priority: EMAIL_PRIORITY_MARKETING,
    defer: true,
  });

  if (!queued.created && !queued.id) {
    return { queued: false, created: false, reason: "suppressed" };
  }

  if (params.kind !== "manual" && queued.created) {
    await prisma.checkoutSession.update({
      where: { id: session.id },
      data: {
        remindersSent: params.kind,
        lastReminderAt: now,
      },
    });
  } else if (params.kind === "manual" && queued.created) {
    await prisma.checkoutSession.update({
      where: { id: session.id },
      data: { lastReminderAt: now },
    });
  }

  let warning: string | undefined;
  if (
    params.kind === "manual" &&
    session.lastReminderAt &&
    now.getTime() - session.lastReminderAt.getTime() < RECENT_MANUAL_WARN_MS
  ) {
    warning = "A reminder went out in the last few hours.";
  }

  return { queued: true, created: queued.created, warning };
}

export async function dueAbandonedCheckoutSessions(now: Date, take: number) {
  const firstCutoff = new Date(now.getTime() - FIRST_REMINDER_MS);
  const secondCutoff = new Date(now.getTime() - SECOND_REMINDER_MS);

  const first = await prisma.checkoutSession.findMany({
    where: {
      recoveredAt: null,
      remindersSent: 0,
      lastActiveAt: { lte: firstCutoff },
    },
    orderBy: { lastActiveAt: "asc" },
    take,
  });

  const remaining = Math.max(0, take - first.length);
  const second =
    remaining > 0
      ? await prisma.checkoutSession.findMany({
          where: {
            recoveredAt: null,
            remindersSent: 1,
            lastActiveAt: { lte: secondCutoff },
          },
          orderBy: { lastActiveAt: "asc" },
          take: remaining,
        })
      : [];

  return [
    ...first.map((s) => ({ session: s, kind: 1 as const })),
    ...second.map((s) => ({ session: s, kind: 2 as const })),
  ];
}
