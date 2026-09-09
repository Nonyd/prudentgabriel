export const INTAKE_STAGES = [
  "CONSULTATION_BOOKING",
  "CONSULTATION_SESSION",
  "INVOICE_ISSUANCE",
  "PAYMENT_CONFIRMATION",
] as const;

export type IntakeStage = (typeof INTAKE_STAGES)[number];

export function intakeStageNotes(params: {
  bookingNumber?: string | null;
  quoteRef: string;
  invoiceNumber: string;
  consultationPaid?: boolean;
  consultationPaymentRef?: string | null;
}): Record<IntakeStage, string> {
  const booking = params.bookingNumber
    ? `Completed at convert — consultation ${params.bookingNumber} was already booked.`
    : "Completed at convert — no consultation on this quotation; booking recorded from the approved quote.";
  const session = params.bookingNumber
    ? `Completed at convert — consultation ${params.bookingNumber} session notes are on the commission.`
    : "Completed at convert — consultation session recorded from the approved quotation.";
  const invoice = `Completed at convert — invoice ${params.invoiceNumber} issued from quotation ${params.quoteRef}.`;
  const payment =
    params.consultationPaid && params.consultationPaymentRef
      ? `Completed at convert — consultation payment ${params.consultationPaymentRef} already received. Commission deposit is still due.`
      : params.consultationPaid
        ? "Completed at convert — consultation fee already received. Commission deposit is still due."
        : "Completed at convert — quotation approved. Commission deposit is still due on the invoice.";
  return {
    CONSULTATION_BOOKING: booking,
    CONSULTATION_SESSION: session,
    INVOICE_ISSUANCE: invoice,
    PAYMENT_CONFIRMATION: payment,
  };
}
