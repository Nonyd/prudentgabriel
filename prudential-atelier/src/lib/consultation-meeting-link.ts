import {
  ConsultationDeliveryMode,
  ConsultationStatus,
} from "@prisma/client";
import { dateToWatYmd, isVirtualDelivery } from "@/lib/consultation";
import { isOfferingTypeVirtual, type OfferingTypeKey } from "@/lib/consultation-types";
import { sendConsultationMeetingLinkEmail } from "@/lib/email";

export function meetingLinkIdempotencyKey(bookingNumber: string, meetingLink: string): string {
  return `consultation-meeting-link:${bookingNumber}:${meetingLink.trim()}`;
}

export function meetingReminderIdempotencyKey(bookingNumber: string): string {
  return `consultation-meeting-reminder:${bookingNumber}`;
}

/** WAT is UTC+1 year-round. */
export function consultationSessionStart(confirmedDate: Date, confirmedTime: string): Date {
  const ymd = dateToWatYmd(confirmedDate);
  const match = /^(\d{2}):(\d{2})$/.exec(confirmedTime.trim());
  const hh = match?.[1] ?? "00";
  const mm = match?.[2] ?? "00";
  return new Date(`${ymd}T${hh}:${mm}:00+01:00`);
}

/** True when `now` is 45–75 minutes before the session (a 15-minute cron hits once). */
export function isMeetingReminderWindow(startsAt: Date, now: Date): boolean {
  const ms = startsAt.getTime() - now.getTime();
  return ms > 45 * 60 * 1000 && ms <= 75 * 60 * 1000;
}

export function bookingIsVirtual(booking: {
  offeringType?: string | null;
  offering?: { deliveryMode: ConsultationDeliveryMode } | null;
}): boolean {
  if (booking.offeringType && isOfferingTypeVirtual(booking.offeringType as OfferingTypeKey)) {
    return true;
  }
  return booking.offering ? isVirtualDelivery(booking.offering.deliveryMode) : false;
}

export async function queueConsultationMeetingLink(params: {
  to: string;
  clientName: string;
  bookingNumber: string;
  platformLabel: string;
  confirmedDate: Date;
  confirmedTime: string;
  meetingLink: string;
  isWhatsApp: boolean;
  kind?: "link" | "reminder";
}): Promise<void> {
  await sendConsultationMeetingLinkEmail({
    to: params.to,
    clientName: params.clientName,
    bookingNumber: params.bookingNumber,
    platformLabel: params.platformLabel,
    confirmedDate: params.confirmedDate.toISOString(),
    confirmedTime: params.confirmedTime,
    meetingLink: params.meetingLink,
    isWhatsApp: params.isWhatsApp,
    kind: params.kind ?? "link",
  });
}

export function shouldQueueMeetingLinkOnSave(params: {
  previousLink: string | null;
  nextLink: string | null | undefined;
  status: ConsultationStatus;
  confirmedDate: Date | null;
  confirmedTime: string | null;
  isVirtual: boolean;
  confirmEmailAlreadyCarriesLink: boolean;
}): boolean {
  const link = params.nextLink?.trim() ?? "";
  if (!link || !params.isVirtual) return false;
  if (!params.confirmedDate || !params.confirmedTime) return false;
  if (params.confirmEmailAlreadyCarriesLink) return false;
  if (link === (params.previousLink ?? "").trim()) return false;
  return (
    params.status === ConsultationStatus.CONFIRMED ||
    params.status === ConsultationStatus.SCHEDULED
  );
}
