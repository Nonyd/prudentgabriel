import type { BespokeStage } from "@prisma/client";

export const STAGE_ORDER: BespokeStage[] = [
  "CONSULTATION_BOOKING",
  "CONSULTATION_SESSION",
  "INVOICE_ISSUANCE",
  "PAYMENT_CONFIRMATION",
  "SKETCHING_CONCEPT",
  "FABRIC_SOURCING",
  "DESIGN_APPROVAL",
  "TAILORING",
  "FIRST_FITTING",
  "ALTERATIONS",
  "BEADING_FINISHING",
  "FINAL_FITTING",
  "DELIVERY",
];

export const STAGE_LABELS: Record<BespokeStage, string> = {
  CONSULTATION_BOOKING: "1. Consultation Booking",
  CONSULTATION_SESSION: "2. Consultation Session",
  INVOICE_ISSUANCE: "3. Invoice Issuance",
  PAYMENT_CONFIRMATION: "4. Payment Confirmation",
  SKETCHING_CONCEPT: "5. Sketching & Concept",
  FABRIC_SOURCING: "6. Fabric Sourcing",
  DESIGN_APPROVAL: "7. Design Approval",
  TAILORING: "8. Tailoring / Construction",
  FIRST_FITTING: "9. First Fitting",
  ALTERATIONS: "10. Alterations",
  BEADING_FINISHING: "11. Beading & Finishing",
  FINAL_FITTING: "12. Final Fitting",
  DELIVERY: "13. Delivery / Collection",
};

export const STAGE_DESCRIPTIONS: Record<BespokeStage, string> = {
  CONSULTATION_BOOKING: "Your consultation slot is reserved and confirmed.",
  CONSULTATION_SESSION: "We meet to understand your vision, occasion, and preferences.",
  INVOICE_ISSUANCE: "A detailed quotation is prepared for your approval.",
  PAYMENT_CONFIRMATION: "Your deposit or full payment is verified and recorded.",
  SKETCHING_CONCEPT: "Initial sketches and design concepts are developed for review.",
  FABRIC_SOURCING: "Premium fabrics are selected and sourced for your commission.",
  DESIGN_APPROVAL: "Final design, fabric, and embellishments are approved by you.",
  TAILORING: "Our artisans construct your garment with precision and care.",
  FIRST_FITTING: "Your first fitting ensures the silhouette and structure are correct.",
  ALTERATIONS: "Adjustments are made based on fitting feedback.",
  BEADING_FINISHING: "Hand-beading, embroidery, and finishing details are applied.",
  FINAL_FITTING: "A final fitting confirms the perfect fit before delivery.",
  DELIVERY: "Your completed commission is delivered or ready for collection.",
};

export const STAGE_SHORT_LABELS: Record<BespokeStage, string> = {
  CONSULTATION_BOOKING: "Consultation Booking",
  CONSULTATION_SESSION: "Consultation Session",
  INVOICE_ISSUANCE: "Invoice Issuance",
  PAYMENT_CONFIRMATION: "Payment Confirmation",
  SKETCHING_CONCEPT: "Sketching & Concept",
  FABRIC_SOURCING: "Fabric Sourcing",
  DESIGN_APPROVAL: "Design Approval",
  TAILORING: "Tailoring",
  FIRST_FITTING: "First Fitting",
  ALTERATIONS: "Alterations",
  BEADING_FINISHING: "Beading & Finishing",
  FINAL_FITTING: "Final Fitting",
  DELIVERY: "Delivery",
};

export function getNextStage(current: BespokeStage): BespokeStage | null {
  const idx = STAGE_ORDER.indexOf(current);
  return idx < STAGE_ORDER.length - 1 ? STAGE_ORDER[idx + 1]! : null;
}

export function getStageProgress(current: BespokeStage): number {
  return STAGE_ORDER.indexOf(current) + 1;
}

export function getPreviousStage(current: BespokeStage): BespokeStage | null {
  const idx = STAGE_ORDER.indexOf(current);
  return idx > 0 ? STAGE_ORDER[idx - 1]! : null;
}

export function isStageCompleted(
  stage: BespokeStage,
  currentStage: BespokeStage,
  completedStages: BespokeStage[],
): boolean {
  if (completedStages.includes(stage)) return true;
  return STAGE_ORDER.indexOf(stage) < STAGE_ORDER.indexOf(currentStage);
}

export function generateBespokeOrderRef(): string {
  const n = Math.floor(Math.random() * 9000) + 1000;
  return `ORD-${n}`;
}

export function generateQuoteRef(): string {
  const y = String(new Date().getFullYear());
  const n = Math.floor(Math.random() * 9999) + 1;
  return `QT-${y}-${String(n).padStart(4, "0")}`;
}

export type DeliveryUrgency = "overdue" | "soon" | "ok" | "none";

type DateLike = Date | string | null | undefined;

function toDate(value: DateLike): Date | null {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getDeliveryUrgency(deliveryDate: DateLike): DeliveryUrgency {
  const parsed = toDate(deliveryDate);
  if (!parsed) return "none";
  const now = new Date();
  const diff = parsed.getTime() - now.getTime();
  const days = diff / (1000 * 60 * 60 * 24);
  if (days < 0) return "overdue";
  if (days <= 7) return "soon";
  return "ok";
}

export function getOrderTrackStatus(
  deliveryDate: DateLike,
  currentStage: BespokeStage,
): "On Track" | "Watch" | "Urgent" {
  const urgency = getDeliveryUrgency(deliveryDate);
  if (urgency === "overdue") return "Urgent";
  if (urgency === "soon" && currentStage !== "DELIVERY") return "Watch";
  return "On Track";
}
