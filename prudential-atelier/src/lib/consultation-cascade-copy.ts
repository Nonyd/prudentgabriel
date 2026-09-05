import {
  CASCADE_CONFIRMATION,
  formatReceivedNGN,
  joinNamedList,
  type CascadeActorSnap,
  type CascadeDialogCopy,
  type CascadePaymentSnap,
} from "@/lib/cascade-copy";

export const CONSULTATION_CASCADE_RECORD_TYPE = "consultation-cascade-delete";
export const CONSULTATION_CASCADE_MODULE = "consultations";
export const CONSULTATION_CASCADE_CONFIRMATION = CASCADE_CONFIRMATION;

export type ConsultationCascadeBookingSnap = {
  id: string;
  bookingNumber: string;
  clientName: string;
  clientEmail: string;
  type: string | null;
  date: string | null;
  feeNGN: number;
  feePaidNGN: number;
  quotationRefs: string[];
};

export type ConsultationCascadePreview = {
  loud: boolean;
  blocked: boolean;
  blockReason: string | null;
  bookingCount: number;
  bookings: ConsultationCascadeBookingSnap[];
  payments: CascadePaymentSnap[];
  quotationRefs: string[];
  commissionRefs: string[];
  invoiceRefs: string[];
  receivedNGN: number;
  mediaUrls: string[];
};

export type ConsultationCascadeSnapshot = {
  kind: typeof CONSULTATION_CASCADE_RECORD_TYPE;
  bookings: ConsultationCascadeBookingSnap[];
  payments: CascadePaymentSnap[];
  quotationRefs: string[];
  receivedNGN: number;
  actor: CascadeActorSnap;
};

export function consultationDialogCopy(preview: ConsultationCascadePreview): CascadeDialogCopy {
  const n = preview.bookingCount;
  const heading = `${n} ${n === 1 ? "consultation" : "consultations"} will be deleted.`;
  if (preview.blocked) {
    const refs = joinNamedList(preview.commissionRefs.concat(preview.invoiceRefs));
    return {
      title: "Cannot delete this consultation",
      heading: preview.blockReason ?? "This consultation produced a commission or invoice.",
      lines: [
        refs ? `Linked: ${refs}.` : "A live atelier order or invoice is attached.",
        "Remove or finish that work from the atelier order. Deleting from here would orphan it or wipe a commission in progress.",
      ],
      loud: false,
      blocked: true,
    };
  }
  if (!preview.loud) {
    const number = preview.bookings[0]?.bookingNumber;
    return {
      title: number ? `Delete ${number}` : "Delete consultation",
      heading,
      lines: ["No payment and no quotation.", "The client record is kept.", "This cannot be undone."],
      loud: false,
    };
  }
  const lines = ["Deleting this also removes:"];
  if (preview.payments.length > 0) {
    lines.push(`· ${preview.payments.length} ${preview.payments.length === 1 ? "payment" : "payments"} — ${formatReceivedNGN(preview.receivedNGN)} received`);
  }
  if (preview.quotationRefs.length > 0) {
    lines.push(
      `· ${preview.quotationRefs.length === 1 ? "quotation" : "quotations"} ${joinNamedList(preview.quotationRefs)}`,
    );
  }
  lines.push("The client record is kept.");
  lines.push("This cannot be undone.");
  return {
    title: "Delete a paid or quoted consultation",
    heading,
    lines,
    loud: true,
  };
}
