import { ConsultationStatus } from "@prisma/client";
import type { PublicConsultationDto } from "@/lib/public-pii-dtos";

export function consultationSuccessView(dto: PublicConsultationDto) {
  const confirmed = dto.status === ConsultationStatus.CONFIRMED;
  const pending = dto.status === ConsultationStatus.PENDING_CONFIRMATION;
  return {
    bookingNumber: dto.bookingNumber,
    consultantName: dto.consultantName ?? "Our team",
    offeringName: dto.offeringName,
    confirmed,
    pending,
    dateLabel:
      confirmed && dto.confirmedDate
        ? new Date(dto.confirmedDate).toLocaleDateString("en-GB", { timeZone: "Africa/Lagos" })
        : null,
    timeLabel: confirmed ? dto.confirmedTime : null,
    heading: confirmed ? "Consultation confirmed" : pending ? "Request submitted" : "Thank you",
    subcopy: confirmed
      ? "Your session is booked. A confirmation is on its way."
      : pending
        ? "We will confirm your slot within 24–48 hours."
        : `Status: ${dto.status}`,
  };
}
