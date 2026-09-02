import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSetting, getSettings } from "@/lib/settings";
import { resolvePublicBankAccount } from "@/lib/payments/bank-account";
import { getPublicAppUrl } from "@/lib/app-url";
import { allocateInvoiceNumber } from "@/lib/document-numbers";
import { getLogoSettings } from "@/lib/logos";
import { CUSTOMER_HOUSE_NAME } from "@/lib/customer-email";
import type {
  InvoiceBankDetails,
  InvoiceBusinessDetails,
  InvoiceCurrency,
  InvoiceLineItem,
  InvoicePaymentEntry,
} from "@/types/invoice";

const lineItemSchema = z.object({
  id: z.string(),
  description: z.string(),
  details: z.string().optional(),
  quantity: z.number(),
  unitPrice: z.number(),
  amount: z.number(),
});

const paymentEntrySchema = z.object({
  recordedAt: z.string(),
  amount: z.number(),
  method: z.string(),
  reference: z.string().optional(),
});

export function parseInvoiceLineItems(raw: unknown): InvoiceLineItem[] {
  const arr = z.array(lineItemSchema).safeParse(raw);
  return arr.success ? arr.data : [];
}

export function parseInvoicePaymentHistory(raw: unknown): InvoicePaymentEntry[] {
  const arr = z.array(paymentEntrySchema).safeParse(raw);
  return arr.success ? arr.data : [];
}

function boolFromSetting(v: string | undefined): boolean {
  return v === "true" || v === "1";
}

export async function generateInvoiceNumber(
  client?: Prisma.TransactionClient | typeof prisma,
): Promise<string> {
  return allocateInvoiceNumber(client);
}

export async function getInvoiceSettings(): Promise<InvoiceBusinessDetails> {
  const [s, logos] = await Promise.all([getSettings("INVOICE"), getLogoSettings()]);
  // Transparent/dark-on-light logo for branded PDFs (standing rule).
  const pdfLogo =
    logos.atelier.dark ||
    logos.logoDark ||
    s.invoice_logo_url ||
    "";
  return {
    businessName: s.invoice_business_name ?? CUSTOMER_HOUSE_NAME,
    tagline: s.invoice_tagline ?? "",
    addressLine1: s.invoice_address_line1 ?? "",
    addressLine2: s.invoice_address_line2 ?? "",
    city: s.invoice_city ?? "",
    phone: s.invoice_phone ?? "",
    email: s.invoice_email ?? "",
    website: s.invoice_website ?? "",
    rcNumber: s.invoice_rc_number ?? "",
    showRc: boolFromSetting(s.invoice_show_rc),
    logoUrl: resolveAssetUrl(pdfLogo),
    footerNote: s.invoice_footer_note ?? "",
  };
}

export function resolveAssetUrl(pathOrUrl: string): string {
  const t = pathOrUrl.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  const base = getPublicAppUrl().replace(/\/+$/, "");
  const p = t.startsWith("/") ? t : `/${t}`;
  return `${base}${p}`;
}

export async function getBankDetails(currency: InvoiceCurrency): Promise<InvoiceBankDetails> {
  const account = await resolvePublicBankAccount(currency, "ATELIER");
  if (!account) {
    return {
      currency,
      bankName: "",
      accountName: "",
      accountNumber: "",
    };
  }
  return {
    currency,
    bankName: account.bankName,
    accountName: account.accountName,
    accountNumber: account.accountNumber,
    swiftBic: account.swiftBic,
    iban: account.iban,
    sortCode: account.sortCode,
    routingNumber: account.routingNumber,
    intermediaryBank: account.intermediaryBank,
    instructions: account.instructions,
    feeBearer: account.feeBearer,
    feeTolerance: account.feeTolerance,
  };
}

export async function getInvoiceDefaultPaymentTerms(): Promise<string> {
  return (await getSetting("invoice_deposit_terms")) ?? "";
}

export async function getInvoiceDefaultDueDays(): Promise<number> {
  const v = await getSetting("invoice_default_due_days");
  const n = v != null ? Number.parseInt(v, 10) : 7;
  return Number.isFinite(n) && n >= 0 ? n : 7;
}

export async function getInvoiceDefaultVatPercent(): Promise<number> {
  const v = await getSetting("invoice_default_vat");
  const n = v != null ? Number.parseFloat(v) : 0;
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function calculateInvoiceTotals(params: {
  lineItems: InvoiceLineItem[];
  discountType?: "PERCENTAGE" | "FIXED" | null;
  discountValue?: number;
  vatEnabled?: boolean;
  vatPercent?: number;
  depositPercent?: number;
  depositPaid?: number;
}): {
  subtotal: number;
  discountAmount: number;
  vatAmount: number;
  total: number;
  depositRequired: number;
  balanceDue: number;
} {
  const lineItems = params.lineItems;
  const subtotal = lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);

  let discountAmount = 0;
  const dtype = params.discountType;
  const dval = params.discountValue ?? 0;
  if (dtype === "PERCENTAGE" && dval > 0) {
    discountAmount = Math.round(subtotal * (dval / 100) * 100) / 100;
  } else if (dtype === "FIXED" && dval > 0) {
    discountAmount = Math.min(dval, subtotal);
  }

  const afterDiscount = Math.max(0, subtotal - discountAmount);

  let vatAmount = 0;
  if (params.vatEnabled && (params.vatPercent ?? 0) > 0) {
    const pct = params.vatPercent ?? 0;
    vatAmount = Math.round(afterDiscount * (pct / 100) * 100) / 100;
  }

  const total = Math.round((afterDiscount + vatAmount) * 100) / 100;

  const depPct = params.depositPercent ?? 0;
  const depositRequired =
    depPct > 0 ? Math.round(total * (depPct / 100) * 100) / 100 : 0;

  const paid = params.depositPaid ?? 0;
  const balanceDue = Math.round(Math.max(0, total - paid) * 100) / 100;

  return { subtotal, discountAmount, vatAmount, total, depositRequired, balanceDue };
}

export function asInvoiceCurrency(c: string): InvoiceCurrency {
  if (c === "USD" || c === "GBP" || c === "EUR") return c;
  return "NGN";
}

export function formatInvoiceCurrency(amount: number, currency: InvoiceCurrency): string {
  const n = Math.abs(amount);
  const opts: Intl.NumberFormatOptions = { minimumFractionDigits: 0, maximumFractionDigits: 2 };
  if (currency === "NGN") {
    return `₦${n.toLocaleString("en-NG", opts)}`;
  }
  if (currency === "USD") {
    return `$${n.toLocaleString("en-US", opts)}`;
  }
  if (currency === "EUR") {
    return `€${n.toLocaleString("en-IE", opts)}`;
  }
  return `£${n.toLocaleString("en-GB", opts)}`;
}

export function syncLineItemAmounts(items: InvoiceLineItem[]): InvoiceLineItem[] {
  return items.map((li) => ({
    ...li,
    amount: Math.round(li.quantity * li.unitPrice * 100) / 100,
  }));
}
