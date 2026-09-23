import { prisma } from "@/lib/prisma";
import {
  assertCapabilityNotExpired,
  CAPABILITY_TTL_MS,
  capabilityLookupKey,
  generateCapabilityToken,
  invoiceCapabilityExpiresAt,
  revealCapabilityToken,
} from "@/lib/capability-token";

type Gate = "missing" | "expired";

export async function findInvoiceByPublicToken(raw: string) {
  const inv = await prisma.invoice.findUnique({
    where: { publicToken: capabilityLookupKey(raw) },
  });
  if (!inv) return { ok: false as const, reason: "missing" as Gate };
  if (assertCapabilityNotExpired(inv.publicTokenExpiresAt) === "expired") {
    return { ok: false as const, reason: "expired" as Gate };
  }
  return { ok: true as const, inv };
}

export async function findOrderByTrackingToken(raw: string) {
  const order = await prisma.bespokeOrder.findUnique({
    where: { trackingToken: capabilityLookupKey(raw) },
  });
  if (!order) return { ok: false as const, reason: "missing" as Gate };
  if (assertCapabilityNotExpired(order.trackingTokenExpiresAt) === "expired") {
    return { ok: false as const, reason: "expired" as Gate };
  }
  return { ok: true as const, order };
}

export async function findOrderByReceiptToken(raw: string) {
  const order = await prisma.bespokeOrder.findUnique({
    where: { receiptConfirmToken: capabilityLookupKey(raw) },
  });
  if (!order) return { ok: false as const, reason: "missing" as Gate };
  if (assertCapabilityNotExpired(order.receiptConfirmTokenExpiresAt) === "expired") {
    return { ok: false as const, reason: "expired" as Gate };
  }
  return { ok: true as const, order };
}

export async function findStageApprovalByPublicToken(raw: string) {
  const approval = await prisma.stageApproval.findUnique({
    where: { publicToken: capabilityLookupKey(raw) },
  });
  if (!approval) return { ok: false as const, reason: "missing" as Gate };
  if (assertCapabilityNotExpired(approval.publicTokenExpiresAt) === "expired") {
    return { ok: false as const, reason: "expired" as Gate };
  }
  return { ok: true as const, approval };
}

export async function findQuotationByApprovalToken(raw: string) {
  const quote = await prisma.quotation.findUnique({
    where: { approvalToken: capabilityLookupKey(raw) },
  });
  if (!quote) return { ok: false as const, reason: "missing" as Gate };
  if (assertCapabilityNotExpired(quote.approvalTokenExpiresAt) === "expired") {
    return { ok: false as const, reason: "expired" as Gate };
  }
  return { ok: true as const, quote };
}

export function publicInvoicePath(inv: {
  publicToken: string;
  publicTokenEnc?: string | null;
}): string | null {
  const raw = revealCapabilityToken({ token: inv.publicToken, enc: inv.publicTokenEnc });
  return raw ? `/invoice/${raw}` : null;
}

export function publicTrackPath(order: {
  trackingToken: string;
  trackingTokenEnc?: string | null;
}): string | null {
  const raw = revealCapabilityToken({ token: order.trackingToken, enc: order.trackingTokenEnc });
  return raw ? `/track/${raw}` : null;
}

export function publicReceiptPath(order: {
  receiptConfirmToken: string;
  receiptConfirmTokenEnc?: string | null;
}): string | null {
  const raw = revealCapabilityToken({
    token: order.receiptConfirmToken,
    enc: order.receiptConfirmTokenEnc,
  });
  return raw ? `/receipt/${raw}` : null;
}

export function publicApprovePath(approval: {
  publicToken: string;
  publicTokenEnc?: string | null;
}): string | null {
  const raw = revealCapabilityToken({ token: approval.publicToken, enc: approval.publicTokenEnc });
  return raw ? `/approve/${raw}` : null;
}

export function publicQuotePath(quote: {
  approvalToken: string;
  approvalTokenEnc?: string | null;
}): string | null {
  const raw = revealCapabilityToken({ token: quote.approvalToken, enc: quote.approvalTokenEnc });
  return raw ? `/quote/${raw}` : null;
}

/** Reveal raw for URL, or rotate hash/enc when Enc is missing (broken new issuance). */
export async function ensureInvoicePublicRaw(inv: {
  id: string;
  publicToken: string;
  publicTokenEnc?: string | null;
  publicTokenExpiresAt?: Date | null;
  expiresAt?: Date | null;
  paidAt?: Date | null;
}): Promise<string> {
  const existing = revealCapabilityToken({ token: inv.publicToken, enc: inv.publicTokenEnc });
  if (existing) return existing;
  const tok = generateCapabilityToken();
  await prisma.invoice.update({
    where: { id: inv.id },
    data: {
      publicToken: tok.hash,
      publicTokenEnc: tok.enc,
      publicTokenExpiresAt:
        inv.publicTokenExpiresAt ??
        invoiceCapabilityExpiresAt({
          documentExpiresAt: inv.expiresAt,
          paidAt: inv.paidAt ?? null,
        }),
    },
  });
  return tok.raw;
}

export async function ensureTrackingRaw(order: {
  id: string;
  trackingToken: string;
  trackingTokenEnc?: string | null;
  trackingTokenExpiresAt?: Date | null;
}): Promise<string> {
  const existing = revealCapabilityToken({
    token: order.trackingToken,
    enc: order.trackingTokenEnc,
  });
  if (existing) return existing;
  const tok = generateCapabilityToken();
  await prisma.bespokeOrder.update({
    where: { id: order.id },
    data: {
      trackingToken: tok.hash,
      trackingTokenEnc: tok.enc,
      trackingTokenExpiresAt:
        order.trackingTokenExpiresAt ?? new Date(Date.now() + CAPABILITY_TTL_MS.track),
    },
  });
  return tok.raw;
}

export async function ensureReceiptConfirmRaw(order: {
  id: string;
  receiptConfirmToken: string;
  receiptConfirmTokenEnc?: string | null;
  receiptConfirmTokenExpiresAt?: Date | null;
}): Promise<string> {
  const existing = revealCapabilityToken({
    token: order.receiptConfirmToken,
    enc: order.receiptConfirmTokenEnc,
  });
  if (existing) return existing;
  const tok = generateCapabilityToken();
  await prisma.bespokeOrder.update({
    where: { id: order.id },
    data: {
      receiptConfirmToken: tok.hash,
      receiptConfirmTokenEnc: tok.enc,
      receiptConfirmTokenExpiresAt:
        order.receiptConfirmTokenExpiresAt ??
        new Date(Date.now() + CAPABILITY_TTL_MS.receiptConfirm),
    },
  });
  return tok.raw;
}

export async function ensureStageApprovalRaw(approval: {
  id: string;
  publicToken: string;
  publicTokenEnc?: string | null;
  publicTokenExpiresAt?: Date | null;
}): Promise<string> {
  const existing = revealCapabilityToken({
    token: approval.publicToken,
    enc: approval.publicTokenEnc,
  });
  if (existing) return existing;
  const tok = generateCapabilityToken();
  await prisma.stageApproval.update({
    where: { id: approval.id },
    data: {
      publicToken: tok.hash,
      publicTokenEnc: tok.enc,
      publicTokenExpiresAt:
        approval.publicTokenExpiresAt ??
        new Date(Date.now() + CAPABILITY_TTL_MS.stageApproval),
    },
  });
  return tok.raw;
}

export async function ensureQuoteApprovalRaw(quote: {
  id: string;
  approvalToken: string;
  approvalTokenEnc?: string | null;
  approvalTokenExpiresAt?: Date | null;
  expiresAt?: Date | null;
}): Promise<string> {
  const existing = revealCapabilityToken({
    token: quote.approvalToken,
    enc: quote.approvalTokenEnc,
  });
  if (existing) return existing;
  const tok = generateCapabilityToken();
  const expires =
    quote.approvalTokenExpiresAt ??
    quote.expiresAt ??
    new Date(Date.now() + CAPABILITY_TTL_MS.stageApproval);
  await prisma.quotation.update({
    where: { id: quote.id },
    data: {
      approvalToken: tok.hash,
      approvalTokenEnc: tok.enc,
      approvalTokenExpiresAt: expires,
    },
  });
  return tok.raw;
}

export function quotationApprovalExpiresAt(quoteExpiresAt: Date | null | undefined): Date {
  return quoteExpiresAt ?? new Date(Date.now() + CAPABILITY_TTL_MS.stageApproval);
}

/** Token sweep: abandoned-checkout restore link. Unknown, expired and used answer alike. */
export async function findCheckoutSessionByRestoreToken(raw: string) {
  const key = capabilityLookupKey(raw);
  if (!key) return null;
  const session = await prisma.checkoutSession.findUnique({ where: { restoreToken: key } });
  if (!session || session.recoveredAt) return null;
  if (assertCapabilityNotExpired(session.restoreTokenExpiresAt) === "expired") return null;
  return session;
}

/** The raw restore link for a reminder; every reminder for one bag carries the same link. */
export async function ensureRestoreRaw(session: {
  id: string;
  restoreToken: string;
  restoreTokenEnc?: string | null;
  restoreTokenExpiresAt?: Date | null;
}): Promise<string> {
  const existing = revealCapabilityToken({ token: session.restoreToken, enc: session.restoreTokenEnc });
  const live = assertCapabilityNotExpired(session.restoreTokenExpiresAt) === "ok";
  if (existing && live) return existing;
  const tok = generateCapabilityToken();
  await prisma.checkoutSession.update({
    where: { id: session.id },
    data: {
      restoreToken: tok.hash,
      restoreTokenEnc: tok.enc,
      restoreTokenExpiresAt: new Date(Date.now() + CAPABILITY_TTL_MS.checkoutRestore),
    },
  });
  return tok.raw;
}

/** Token sweep: marketing unsubscribe link. Never expires (capability-registry.ts says why). */
export async function findEmailPreferenceByUnsubscribeToken(raw: string) {
  const key = capabilityLookupKey(raw);
  if (!key) return null;
  return prisma.emailPreference.findUnique({ where: { unsubscribeToken: key } });
}

/** The raw unsubscribe link for an address; the same one in every email. */
export async function ensureUnsubscribeRaw(pref: {
  id: string;
  unsubscribeToken: string;
  unsubscribeTokenEnc?: string | null;
}): Promise<string> {
  const existing = revealCapabilityToken({ token: pref.unsubscribeToken, enc: pref.unsubscribeTokenEnc });
  if (existing) return existing;
  const tok = generateCapabilityToken();
  // Only replace the default the row was created with; a concurrent send may have issued one.
  const claimed = await prisma.emailPreference.updateMany({
    where: { id: pref.id, unsubscribeTokenEnc: null },
    data: { unsubscribeToken: tok.hash, unsubscribeTokenEnc: tok.enc },
  });
  if (claimed.count === 1) return tok.raw;
  const again = await prisma.emailPreference.findUniqueOrThrow({ where: { id: pref.id } });
  const raw = revealCapabilityToken({ token: again.unsubscribeToken, enc: again.unsubscribeTokenEnc });
  if (!raw) throw new Error("Could not issue an unsubscribe link");
  return raw;
}

/** Token sweep: staff invitation. Unknown, expired and accepted answer alike. */
export async function findPendingInvitationByToken(raw: string) {
  const key = capabilityLookupKey(raw);
  if (!key) return null;
  const invitation = await prisma.teamInvitation.findUnique({ where: { token: key } });
  if (!invitation || invitation.acceptedAt) return null;
  if (assertCapabilityNotExpired(invitation.expiresAt) === "expired") return null;
  return invitation;
}
