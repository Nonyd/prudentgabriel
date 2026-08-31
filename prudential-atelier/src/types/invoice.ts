import type { BespokeStatus, Invoice, InvoiceStatus } from "@prisma/client";

export interface InvoiceLineItem {
  id: string;
  description: string;
  details?: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface InvoiceBusinessDetails {
  businessName: string;
  tagline: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  phone: string;
  email: string;
  website: string;
  rcNumber: string;
  showRc: boolean;
  logoUrl: string;
  footerNote: string;
}

export interface InvoiceBankDetails {
  currency: InvoiceCurrency;
  bankName: string;
  accountName: string;
  accountNumber: string;
  swiftBic?: string;
  iban?: string;
  sortCode?: string;
  routingNumber?: string;
  intermediaryBank?: string;
  instructions?: string;
  feeBearer?: "CUSTOMER" | "HOUSE" | "SHARED";
  feeTolerance?: number;
}

export interface InvoicePaymentEntry {
  recordedAt: string;
  amount: number;
  method: string;
  reference?: string;
}

export type InvoiceCurrency = "NGN" | "USD" | "GBP" | "EUR";

export type PublicInvoicePayload = {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  clientAddress: string | null;
  clientCity: string | null;
  clientCountry: string;
  clientInstagram: string | null;
  currency: string;
  exchangeRate: number;
  status: InvoiceStatus;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  discountType: string | null;
  discountValue: number;
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
  showRcNumber: boolean;
  sentAt: string | null;
  viewedAt: string | null;
  viewCount: number;
  createdAt: string;
  bespokeRequest: { id: string; requestNumber: string; occasion: string } | null;
  businessDetails: InvoiceBusinessDetails;
  bankDetails: InvoiceBankDetails;
};

export type InvoiceWithBespoke = Invoice & {
  bespokeRequest: { id: string; requestNumber: string; occasion: string; status: BespokeStatus } | null;
};
