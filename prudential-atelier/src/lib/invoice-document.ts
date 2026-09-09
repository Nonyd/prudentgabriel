import type { InvoiceBankDetails, InvoiceCurrency } from "@/types/invoice";
import { formatInvoiceCurrency } from "@/lib/invoice";
import { amountDueNow, formatDepositLabel } from "@/lib/invoice-deposit";
import { isDocumentExpired, EXPIRED_INVOICE_PAYMENT } from "@/lib/document-validity";
import { amountInWords, payInstructionLine } from "@/lib/money-in-words";
import type { HouseDocumentTerm } from "@/lib/invoice-terms";

export type InvoiceDocumentRender = {
  expiresAt: Date | null;
  expired: boolean;
  expiredPayment: "warn" | "refuse";
  houseTerms: HouseDocumentTerm[];
  bankCurrency: InvoiceCurrency;
  bankAccountNumber: string;
  depositPercent: number;
  depositLabel: string;
  amountDueNow: number;
  amountDueNowWords: string;
  payInstruction: string;
};

export function assembleInvoiceDocumentRender(params: {
  currency: InvoiceCurrency;
  expiresAt: Date | null;
  houseTerms: HouseDocumentTerm[];
  bank: InvoiceBankDetails;
  depositPercent: number;
  depositRequired: number;
  depositPaid: number;
  balanceDue: number;
  now?: Date;
}): InvoiceDocumentRender {
  const due = amountDueNow({
    depositRequired: params.depositRequired,
    depositPaid: params.depositPaid,
    balanceDue: params.balanceDue,
  });
  const formatted = formatInvoiceCurrency(due, params.currency);
  return {
    expiresAt: params.expiresAt,
    expired: isDocumentExpired(params.expiresAt, params.now),
    expiredPayment: EXPIRED_INVOICE_PAYMENT,
    houseTerms: params.houseTerms,
    bankCurrency: params.bank.currency,
    bankAccountNumber: params.bank.accountNumber,
    depositPercent: params.depositPercent,
    depositLabel: formatDepositLabel(params.depositPercent, formatInvoiceCurrency(params.depositRequired, params.currency)),
    amountDueNow: due,
    amountDueNowWords: amountInWords(due, params.currency),
    payInstruction: payInstructionLine(due, params.currency, formatted),
  };
}
