/**
 * Slice AM — the invoice the house actually uses.
 *
 *   pnpm test:slice-am
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { assembleInvoiceDocumentRender } from "../src/lib/invoice-document";
import {
  amountDueNow,
  clampDepositPercent,
  depositAmountFromPercent,
  depositRequiredNgnFromInvoice,
  formatDepositLabel,
} from "../src/lib/invoice-deposit";
import {
  EXPIRED_INVOICE_PAYMENT,
  expiredInvoiceBlocksPayment,
  isDocumentExpired,
} from "../src/lib/document-validity";
import { amountInWords, payInstructionLine } from "../src/lib/money-in-words";
import { DEFAULT_HOUSE_DOCUMENT_TERMS, houseTermsFromValues } from "../src/lib/invoice-terms";
import { billToDisplayLines, billToOmitsLineItem } from "../src/lib/bill-to-lines";
import { formatInvoiceCurrency } from "../src/lib/invoice";
import { CUSTOM_RETURNS_COPY } from "../src/lib/custom-size";
import type { InvoiceBankDetails } from "../src/types/invoice";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

function run() {
  const onyinyeTotal = 12_000_000;
  const ninety = depositAmountFromPercent(onyinyeTotal, 90);
  assert(ninety === 10_800_000, `90% of ₦12,000,000 is ₦10,800,000, got ${ninety}`);
  assert(
    formatDepositLabel(90, formatInvoiceCurrency(ninety, "NGN")) === "90% (₦10,800,000)",
    "deposit label matches the house invoice: 90% (₦10,800,000)",
  );
  assert(clampDepositPercent(0) === 0, "0% is a real override, not a missing value");
  assert(clampDepositPercent(140) === 100, "percent clamps at 100");

  const cmsSeventy = 70;
  const ninetyInvoice = depositRequiredNgnFromInvoice({
    invoice: { depositRequired: 10_800_000, exchangeRate: 1 },
    orderTotalNgn: onyinyeTotal,
    fallbackPercent: cmsSeventy,
  });
  assert(ninetyInvoice === 10_800_000, "production gate reads the invoice figure, not CMS 70%");

  const zeroInvoice = depositRequiredNgnFromInvoice({
    invoice: { depositRequired: 0, exchangeRate: 1 },
    orderTotalNgn: onyinyeTotal,
    fallbackPercent: cmsSeventy,
  });
  assert(zeroInvoice === 0, "a 0% invoice does not fall back to CMS 70%");

  const noInvoice = depositRequiredNgnFromInvoice({
    invoice: null,
    orderTotalNgn: onyinyeTotal,
    fallbackPercent: cmsSeventy,
  });
  assert(noInvoice === 8_400_000, "CMS default applies only when there is no invoice");

  const gbpInvoice = depositRequiredNgnFromInvoice({
    invoice: { depositRequired: 3360, exchangeRate: 1 / 0.00052 },
    orderTotalNgn: 9_230_769.23,
    fallbackPercent: 70,
  });
  assert(gbpInvoice === 6_461_538.46, `pound invoice deposit converts via the invoice rate, got ${gbpInvoice}`);

  const ledgerSrc = readFileSync(resolve("src/lib/payments/ledger.ts"), "utf8");
  assert(ledgerSrc.includes("if (invoice) {"), "gate uses the invoice whenever one exists");
  assert(!ledgerSrc.includes("invoice.depositRequired > 0"), "gate does not skip a zero depositRequired");

  const convertSrc = readFileSync(resolve("src/lib/quotation-convert.ts"), "utf8");
  assert(convertSrc.includes("quote.depositPercent"), "convert uses the quotation's percent, not a live CMS read as the value");
  assert(convertSrc.includes("depositPercent,"), "convert persists depositPercent on the invoice");

  const dueNow = amountDueNow({ depositRequired: 10_800_000, depositPaid: 0, balanceDue: 12_000_000 });
  assert(dueNow === 10_800_000, "amount due now is the unpaid deposit");
  const words = amountInWords(dueNow, "NGN");
  assert(words.includes("ten million eight hundred thousand"), `words cover the deposit, got "${words}"`);
  assert(words.endsWith("naira only"), "naira amount in words ends with naira only");
  const instruction = payInstructionLine(dueNow, "NGN", formatInvoiceCurrency(dueNow, "NGN"));
  assert(instruction.startsWith("Kindly pay"), "payment instruction is a kindly-pay line");
  assert(instruction.includes("₦10,800,000"), "kindly-pay line also states the figure");

  const bank: InvoiceBankDetails = {
    currency: "NGN",
    bankName: "Access Bank",
    accountName: "Prudential Atelier",
    accountNumber: "0123456789",
  };
  const expires = new Date("2026-09-20T23:59:59.999Z");
  const render = assembleInvoiceDocumentRender({
    currency: "NGN",
    expiresAt: expires,
    houseTerms: DEFAULT_HOUSE_DOCUMENT_TERMS,
    bank,
    depositPercent: 90,
    depositRequired: 10_800_000,
    depositPaid: 0,
    balanceDue: 12_000_000,
    now: new Date("2026-09-08T12:00:00.000Z"),
  });
  assert(render.expiresAt?.toISOString().slice(0, 10) === "2026-09-20", "invoice render carries a validity date");
  assert(!render.expired, "8 September is still within a 20 September validity");
  assert(render.houseTerms.length === 4, "four house terms render on the invoice");
  assert(render.houseTerms[0].body.includes("good and useable"), "delivery term is the house undertaking");
  assert(render.houseTerms[2].body.includes("DHL"), "shipping term matches Slices K and O");
  assert(render.houseTerms[3].body.includes("fails to meet the agreement"), "refund term is Term 4");
  assert(render.bankCurrency === "NGN", "printed bank matches the invoice currency");
  assert(render.bankAccountNumber === "0123456789", "printed bank is the matching Slice P account");
  assert(render.depositLabel === "90% (₦10,800,000)", "render shows percent and amount");
  assert(render.payInstruction.includes("Kindly pay"), "render includes the payment instruction line");

  const expiredRender = assembleInvoiceDocumentRender({
    currency: "NGN",
    expiresAt: new Date("2026-08-01T23:59:59.999Z"),
    houseTerms: DEFAULT_HOUSE_DOCUMENT_TERMS,
    bank,
    depositPercent: 90,
    depositRequired: 10_800_000,
    depositPaid: 0,
    balanceDue: 12_000_000,
    now: new Date("2026-09-08T12:00:00.000Z"),
  });
  assert(expiredRender.expired, "past validity date is expired");
  assert(EXPIRED_INVOICE_PAYMENT === "warn", "expired invoice policy is warn, not refuse");
  assert(!expiredInvoiceBlocksPayment(), "an expired invoice does not refuse payment");
  assert(!isDocumentExpired(null, new Date("2026-09-08T12:00:00.000Z")), "historic invoices with no expiry stay open");

  const gbpBank: InvoiceBankDetails = {
    currency: "GBP",
    bankName: "Wise",
    accountName: "Prudential Atelier",
    accountNumber: "GB00ATELIER",
  };
  const gbpRender = assembleInvoiceDocumentRender({
    currency: "GBP",
    expiresAt: expires,
    houseTerms: DEFAULT_HOUSE_DOCUMENT_TERMS,
    bank: gbpBank,
    depositPercent: 70,
    depositRequired: 3360,
    depositPaid: 0,
    balanceDue: 4800,
  });
  assert(gbpRender.bankCurrency === "GBP", "a pound invoice prints the pound account, not naira");
  assert(gbpRender.depositLabel.includes("£"), "pound deposit label uses pounds, not naira");

  const invoiceSrc = readFileSync(resolve("src/lib/invoice.ts"), "utf8");
  assert(invoiceSrc.includes('resolvePublicBankAccount(currency, "ATELIER")'), "printed bank is the Slice P ATELIER account for that currency");

  const tokenSrc = readFileSync(resolve("src/app/api/invoice/[token]/route.ts"), "utf8");
  assert(tokenSrc.includes("expiredInvoiceBlocksPayment"), "public invoice consults the warn/refuse policy");
  assert(tokenSrc.includes("canPay"), "public invoice still exposes pay");

  const paySrc = readFileSync(resolve("src/app/api/invoice/[token]/pay/route.ts"), "utf8");
  assert(!paySrc.includes("expiresAt"), "initialize does not refuse an expired invoice");

  const pdfSrc = readFileSync(resolve("src/components/invoice/InvoicePDF.tsx"), "utf8");
  assert(pdfSrc.includes("houseTerms"), "PDF renders house terms");
  assert(pdfSrc.includes("Valid until"), "PDF shows validity date");
  assert(pdfSrc.includes("payInstruction"), "PDF prints the kindly-pay line");
  assert(pdfSrc.includes("footerHandle"), "PDF footer can read prudentialfashionhouse");
  assert(pdfSrc.includes("billToDisplayLines"), "PDF bill-to is name/address, not the first line item");

  const viewSrc = readFileSync(resolve("src/components/invoice/PublicInvoiceView.tsx"), "utf8");
  assert(viewSrc.includes("houseTerms"), "HTML invoice renders terms");
  assert(viewSrc.includes("Valid until"), "HTML invoice shows validity");
  assert(viewSrc.includes("payInstruction"), "HTML invoice prints kindly pay");
  assert(viewSrc.includes("addresseeName"), "public bill-to is the name");
  assert(!viewSrc.includes("data.pieceLabel"), "public bill-to does not print the first line item");

  const billTo = billToDisplayLines({
    name: "Bride Onyinye",
    address: null,
    city: null,
    country: "Nigeria",
    phone: "08169235755",
  });
  assert(billTo[0] === "Bride Onyinye", "bill-to first line is the client");
  assert(billToOmitsLineItem(billTo, "Design & Construction"), "bill-to second line is not the first line item");
  assert(!billTo.includes("Design & Construction"), "gown description stays out of bill-to");

  const cmsTerms = houseTermsFromValues({
    invoice_term_delivery: "Custom delivery copy.",
    invoice_term_changes: "",
    invoice_term_shipping: "",
    invoice_term_refunds: "",
  });
  assert(cmsTerms[0].body === "Custom delivery copy.", "terms come from CMS when set");
  assert(cmsTerms[1].body === DEFAULT_HOUSE_DOCUMENT_TERMS[1].body, "empty CMS falls back to house defaults, not hardcoded in the PDF");

  const quotePdfSrc = readFileSync(resolve("src/lib/quotation-pdf-data.ts"), "utf8");
  assert(quotePdfSrc.includes("quote.depositPercent"), "quotation PDF uses the stored percent, not a live CMS read");
  assert(quotePdfSrc.includes("getHouseDocumentTerms"), "quotation PDF loads CMS terms");

  const schema = readFileSync(resolve("prisma/schema.prisma"), "utf8");
  assert(schema.includes("depositPercent"), "Invoice and quotation store per-document deposit percent");
  const invoiceBlock = schema.slice(schema.indexOf("model Invoice {"), schema.indexOf("enum InvoiceStatus"));
  assert(invoiceBlock.includes("expiresAt"), "Invoice has a validity date distinct from dueDate");
  assert(invoiceBlock.includes("dueDate"), "due date remains for when payment is expected");

  const migration = readFileSync(resolve("prisma/migrations/20260909_slice_am_invoice_document/migration.sql"), "utf8");
  assert(!migration.toLowerCase().includes("documentnumbersequence"), "migration does not touch document number sequence");

  assert(
    CUSTOM_RETURNS_COPY.includes("cannot be returned for a change of mind"),
    "site returns copy states why made-to-measure is not returnable",
  );
  const legal = readFileSync(resolve("scripts/legal-content.ts"), "utf8");
  assert(legal.includes("fails to meet the agreement"), "returns policy markdown matches Term 4");
  assert(legal.includes("48 hours of delivery"), "48-hour fabric/fault window remains the house-failure path");

  const formSrc = readFileSync(resolve("src/components/admin/QuotationFormClient.tsx"), "utf8");
  assert(formSrc.includes("depositPercent"), "admin sets the percentage on the quotation");
  assert(formSrc.includes("formatDepositLabel"), "quotation form shows percent and amount");

  const invForm = readFileSync(resolve("src/components/admin/InvoiceFormPage.tsx"), "utf8");
  assert(invForm.includes("formatDepositLabel"), "invoice form shows 90% (₦…)");
  assert(invForm.includes("expiresAt"), "invoice form has a validity date");
  assert(!invForm.includes("if (termsPreset === \"70_30\") setDepositPct(cmsDepositPct);"), "split preset does not overwrite a per-invoice percent on every render");

  console.log("slice-am: pass");
}

run();
