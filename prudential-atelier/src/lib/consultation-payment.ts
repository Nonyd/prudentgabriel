import {
  ConsultationDeliveryMode,
  ConsultationStatus,
  PaymentGateway,
  PaymentStatus,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getDeliveryModeLabel,
  getSessionTypeLabel,
  isManualFlow,
  isVirtualDelivery,
} from "@/lib/consultation";
import {
  sendAdminConsultationNotification,
  sendConsultationConfirmedEmail,
  sendConsultationPendingEmail,
} from "@/lib/email";

const ATELIER_ADDRESS = "14 Prudential Atelier, Lagos, Nigeria";

function defaultMeetingLink(): string {
  return "https://meet.google.com";
}

export async function fulfillPaidConsultationBooking(params: {
  bookingId: string;
  paymentRef: string;
  gateway: PaymentGateway;
}): Promise<boolean> {
  const existing = await prisma.consultationBooking.findUnique({
    where: { id: params.bookingId },
    select: { id: true, paymentStatus: true },
  });
  if (!existing || existing.paymentStatus !== PaymentStatus.PENDING) {
    return false;
  }

  const booking = await prisma.consultationBooking.findUnique({
    where: { id: params.bookingId },
    include: {
      consultant: true,
      offering: true,
    },
  });
  if (!booking) return false;

  const manual =
    isManualFlow(booking.offering.deliveryMode, booking.consultant.isFlagship) ||
    !booking.confirmedDate ||
    !booking.confirmedTime;

  const nextStatus = manual ? ConsultationStatus.PENDING_CONFIRMATION : ConsultationStatus.CONFIRMED;

  const meetingLink = isVirtualDelivery(booking.offering.deliveryMode) ? defaultMeetingLink() : null;
  const meetingPlatform = isVirtualDelivery(booking.offering.deliveryMode) ? "Google Meet" : null;
  const atelierAddress =
    booking.offering.deliveryMode === ConsultationDeliveryMode.INPERSON_ATELIER ||
    booking.offering.deliveryMode === ConsultationDeliveryMode.INPERSON_ATELIER_PRUDENT
      ? ATELIER_ADDRESS
      : null;

  const updateData: Prisma.ConsultationBookingUpdateInput = {
    paymentStatus: PaymentStatus.PAID,
    paidAt: new Date(),
    paymentRef: params.paymentRef,
    paymentGateway: params.gateway,
    status: nextStatus,
    ...(nextStatus === ConsultationStatus.CONFIRMED && meetingLink && !booking.meetingLink
      ? { meetingLink, meetingPlatform }
      : {}),
    ...(atelierAddress && !booking.atelierAddress ? { atelierAddress } : {}),
  };

  await prisma.$transaction([
    prisma.consultationBooking.update({
      where: { id: booking.id, paymentStatus: PaymentStatus.PENDING },
      data: updateData,
    }),
  ]);

  const refreshed = await prisma.consultationBooking.findUnique({
    where: { id: booking.id },
    include: { consultant: true, offering: true },
  });
  if (!refreshed) return true;

  const sessionTypeLabel = getSessionTypeLabel(refreshed.offering.sessionType);
  const deliveryModeLabel = getDeliveryModeLabel(refreshed.offering.deliveryMode);
  const preferredDates: string[] = [];
  if (refreshed.preferredDate1) preferredDates.push(refreshed.preferredDate1.toISOString());
  if (refreshed.preferredDate2) preferredDates.push(refreshed.preferredDate2.toISOString());
  if (refreshed.preferredDate3) preferredDates.push(refreshed.preferredDate3.toISOString());

  if (refreshed.status === ConsultationStatus.CONFIRMED && refreshed.confirmedDate && refreshed.confirmedTime) {
    await sendConsultationConfirmedEmail({
      to: refreshed.clientEmail,
      clientName: refreshed.clientName,
      bookingNumber: refreshed.bookingNumber,
      consultantName: refreshed.consultant.name,
      sessionTypeLabel,
      deliveryModeLabel,
      confirmedDate: refreshed.confirmedDate,
      confirmedTime: refreshed.confirmedTime,
      durationMinutes: refreshed.offering.durationMinutes,
      meetingLink: refreshed.meetingLink ?? undefined,
      meetingPlatform: refreshed.meetingPlatform ?? undefined,
      atelierAddress: refreshed.atelierAddress ?? undefined,
      isVirtual: isVirtualDelivery(refreshed.offering.deliveryMode),
    });
  } else if (refreshed.status === ConsultationStatus.PENDING_CONFIRMATION) {
    await sendConsultationPendingEmail({
      to: refreshed.clientEmail,
      clientName: refreshed.clientName,
      bookingNumber: refreshed.bookingNumber,
      consultantName: refreshed.consultant.name,
      sessionTypeLabel,
      deliveryModeLabel,
      feeNGN: refreshed.feeNGN,
      preferredDate1: refreshed.preferredDate1 ?? undefined,
      preferredDate2: refreshed.preferredDate2 ?? undefined,
      preferredDate3: refreshed.preferredDate3 ?? undefined,
    });
  }

  await sendAdminConsultationNotification({
    bookingNumber: refreshed.bookingNumber,
    clientName: refreshed.clientName,
    clientEmail: refreshed.clientEmail,
    consultantName: refreshed.consultant.name,
    sessionTypeLabel,
    deliveryModeLabel,
    preferredDates,
    isManual: refreshed.status === ConsultationStatus.PENDING_CONFIRMATION,
  });

  return true;
}
