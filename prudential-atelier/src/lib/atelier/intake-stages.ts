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
  const invoice = invoiceIssuanceNote({
    invoiceNumber: params.invoiceNumber,
    quoteRef: params.quoteRef,
    sent: false,
  });
  const payment = paymentConfirmationNote({
    consultationPaid: Boolean(params.consultationPaid),
    consultationPaymentRef: params.consultationPaymentRef,
    depositSatisfied: false,
  });
  return {
    CONSULTATION_BOOKING: booking,
    CONSULTATION_SESSION: session,
    INVOICE_ISSUANCE: invoice,
    PAYMENT_CONFIRMATION: payment,
  };
}

export function invoiceIssuanceNote(params: {
  invoiceNumber: string;
  quoteRef: string;
  sent: boolean;
}): string {
  if (params.sent) {
    return `Invoice ${params.invoiceNumber} sent from quotation ${params.quoteRef}.`;
  }
  return `Completed at convert — invoice ${params.invoiceNumber} drafted from quotation ${params.quoteRef}. It has not been sent yet.`;
}

export function paymentConfirmationNote(params: {
  consultationPaid?: boolean;
  consultationPaymentRef?: string | null;
  depositSatisfied: boolean;
}): string {
  if (params.depositSatisfied) {
    return "Commission deposit received. Stage 4 is the consultation fee; this note records the commission deposit that unlocks production.";
  }
  if (params.consultationPaid && params.consultationPaymentRef) {
    return `Completed at convert — consultation fee (${params.consultationPaymentRef}) already received. Commission deposit is still due.`;
  }
  if (params.consultationPaid) {
    return "Completed at convert — consultation fee already received. Commission deposit is still due.";
  }
  return "Completed at convert — quotation approved. Commission deposit is still due on the invoice.";
}

export function intakeNotesMatchPaymentState(params: {
  invoiceNote: string;
  paymentNote: string;
  invoiceSent: boolean;
  depositSatisfied: boolean;
}): boolean {
  const invoiceOk = params.invoiceSent
    ? params.invoiceNote.toLowerCase().includes("sent") && !params.invoiceNote.toLowerCase().includes("has not been sent")
    : params.invoiceNote.toLowerCase().includes("draft");
  const paymentOk = params.depositSatisfied
    ? params.paymentNote.toLowerCase().includes("commission deposit received")
    : params.paymentNote.toLowerCase().includes("deposit is still due");
  return invoiceOk && paymentOk;
}
