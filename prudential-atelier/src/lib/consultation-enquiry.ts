import { randomInt } from "node:crypto";
import { ConsultationEnquiryStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import {
  CAPABILITY_TTL_MS,
  capabilityHashesEqual,
  generateCapabilityToken,
  hashCapabilityToken,
  isLegacyCuidToken,
} from "@/lib/capability-token";
import { DEFAULT_SHORT_NOTICE_DAYS, SHORT_NOTICE_DAYS_KEY } from "@/lib/consultation-enquiry-shared";

/**
 * Slice BA2 — a consultation is an invitation, not a purchase.
 *
 *   enquiry → queue (NEW_CONSULTATION, "consultations") → approve / decline (reason
 *   required) → booking link emailed → client proposes three dates and pays →
 *   admin picks one → confirmation → reminders.
 */

export function generateEnquiryNumber(): string {
  const yy = String(new Date().getFullYear()).slice(-2);
  return `CE-${yy}-${String(randomInt(0, 100_000)).padStart(5, "0")}`;
}

export async function getShortNoticeDays(): Promise<number> {
  const n = Number(await getSetting(SHORT_NOTICE_DAYS_KEY));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_SHORT_NOTICE_DAYS;
}

/** An enquiry still PENDING after this long is surfaced to the queue again. */
export const ENQUIRY_WAITING_ALERT_MS = 24 * 60 * 60 * 1000;

export function bookingLinkPath(raw: string): string {
  return `/consultation/book/${raw}`;
}

/** Issue (or re-issue) the booking link. Only the hash is stored; the raw goes in the email. */
export function issueBookingLink(now = new Date()) {
  const issued = generateCapabilityToken();
  return {
    raw: issued.raw,
    data: {
      publicToken: issued.hash,
      publicTokenEnc: issued.enc,
      publicTokenExpiresAt: new Date(now.getTime() + CAPABILITY_TTL_MS.consultationBooking),
    },
  };
}

/**
 * The booking step opens only for an APPROVED, unexpired enquiry that has not
 * booked yet. A pending or declined enquiry, a random database default, a
 * legacy-shaped string and an expired link all look the same: missing.
 */
export async function findBookableEnquiry(raw: string, now = new Date()) {
  const t = raw.trim();
  if (!t || isLegacyCuidToken(t) || t.length < 32) return null;
  const hash = hashCapabilityToken(t);
  const enquiry = await prisma.consultationEnquiry.findUnique({ where: { publicToken: hash } });
  if (!enquiry || !capabilityHashesEqual(enquiry.publicToken, hash)) return null;
  if (enquiry.status !== ConsultationEnquiryStatus.APPROVED) return null;
  if (enquiry.bookingId) return null;
  if (!enquiry.publicTokenExpiresAt || enquiry.publicTokenExpiresAt.getTime() < now.getTime()) return null;
  return enquiry;
}
