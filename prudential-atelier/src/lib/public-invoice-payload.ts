import type { PaymentCurrency } from "@/lib/payments/index";
import { parseInvoiceLineItems } from "@/lib/invoice";
import type { InvoiceBankDetails, InvoiceBusinessDetails, InvoiceCurrency, InvoiceLineItem } from "@/types/invoice";

export type PublicInvoicePayState = {
  canPay: boolean;
  remainingDepositNGN: number;
  remainingBalanceNGN: number;
  remainingDepositDocument: number;
  remainingBalanceDocument: number;
  depositRequiredNGN: number;
  confirmedNGN: number;
  orderId: string | null;
  orderRef: string | null;
  pieceLabel: string;
  fxRateLocked: number | null;
  fxGbpRateLocked: number | null;
  availableCurrencies: PaymentCurrency[];
  defaultCurrency: PaymentCurrency | null;
  createsAccount: boolean;
};

/** Public invoice DTO — amount, piece, reference. No client record. */
export type PublicInvoiceViewPayload = {
  invoiceNumber: string;
  currency: string;
  status: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  discountAmount: number;
  vatEnabled: boolean;
  vatPercent: number;
  vatAmount: number;
  total: number;
  depositRequired: number;
  depositPaid: number;
  balanceDue: number;
  paymentTerms: string | null;
  dueDate: string | null;
  paidAt: string | null;
  clientNote: string | null;
  showVat: boolean;
  createdAt: string;
  addresseeName: string;
  pieceLabel: string;
  businessDetails: InvoiceBusinessDetails;
  bankDetails: InvoiceBankDetails;
  pay: PublicInvoicePayState;
};

export function pieceLabelFromLineItems(raw: unknown): string {
  const items = parseInvoiceLineItems(raw);
  const first = items[0]?.description?.trim();
  return first && first.length > 0 ? first.slice(0, 120) : "Atelier commission";
}

export function publicInvoiceOmitsClientRecord(payload: Record<string, unknown>): boolean {
  const forbidden = ["clientEmail", "clientPhone", "clientAddress", "clientCity", "clientInstagram", "clientCountry"];
  return forbidden.every((key) => !(key in payload) || payload[key] == null);
}

export function asPublicInvoiceCurrency(c: string): InvoiceCurrency {
  if (c === "USD" || c === "GBP" || c === "EUR") return c;
  return "NGN";
}
