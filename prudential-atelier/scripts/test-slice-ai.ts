/**
 * Slice AI — atelier commission path.
 *
 *   pnpm test:slice-ai
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BespokeStage } from "@prisma/client";
import { buildQuoteEmailHtml } from "../src/lib/quote-email";
import { remainingDepositNGN } from "../src/lib/atelier-fx";
import { invoiceExchangeRateFromLocked, lockedDocumentTotal } from "../src/lib/atelier-fx";
import { persistableFxFields, type LockedFx } from "../src/lib/fx";
import { INTAKE_STAGES, intakeStageNotes } from "../src/lib/atelier/intake-stages";
import {
  countLiveCompletions,
  isLiveStageDone,
  liveCompletionStages,
  stageHistoryForLiveCompletions,
} from "../src/lib/atelier/live-stages";
import { publicInvoiceOmitsClientRecord } from "../src/lib/public-invoice-payload";
import { asInvoiceCurrency, formatInvoiceCurrency } from "../src/lib/invoice";
import { adminReceiptSrc } from "../src/lib/media/admin-receipt-src";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const fx: LockedFx = {
  rate: 0.00065,
  gbpRate: 0.00052,
  source: "test",
  fetchedAt: new Date("2026-09-09T00:00:00.000Z"),
  stale: false,
};

function run() {
  const gbpHtml = buildQuoteEmailHtml({
    clientName: "Mrs Prudent",
    quoteRef: "QT-2026-0001",
    total: 2400,
    currency: "GBP",
    approvalUrl: "https://staging.prudentgabriel.com/quote/token",
    lineItems: [{ description: "Evening gown", quantity: 1, unitPrice: 2400, total: 2400 }],
    notes: null,
  });
  assert(gbpHtml.includes("£"), "GBP quote email formats in pounds");
  assert(!gbpHtml.includes("₦"), "GBP quote email must not show naira");
  assert(gbpHtml.includes("2,400") || gbpHtml.includes("2400"), "GBP total is in the email");

  const approvalMoney = formatInvoiceCurrency(2400, asInvoiceCurrency("GBP"));
  assert(approvalMoney.startsWith("£"), "approval page helper formats GBP");

  const ngnHtml = buildQuoteEmailHtml({
    clientName: "A",
    quoteRef: "QT-1",
    total: 1000,
    currency: "NGN",
    approvalUrl: "https://example.com",
    lineItems: [],
    notes: null,
  });
  assert(ngnHtml.includes("₦"), "NGN quote email still uses naira");

  const locked = persistableFxFields(fx);
  assert(locked.fxRateLocked === fx.rate, "lock copies USD per ₦1");
  assert(locked.fxGbpRateLocked === fx.gbpRate, "lock copies GBP per ₦1");
  const rate = invoiceExchangeRateFromLocked("GBP", fx);
  assert(Math.abs(rate - 1 / fx.gbpRate) < 0.01, "invoice exchangeRate is NGN per £1, not 1");
  const totals = lockedDocumentTotal("GBP", 2400);
  assert(totals.fxGbpAmountLocked === 2400, "GBP document total is stored at send");

  const remaining = remainingDepositNGN({ depositRequiredNGN: 700_000, confirmedNGN: 200_000 });
  assert(remaining === 500_000, "remaining deposit is invoice figure minus confirmed, not 70% of balance");
  assert(remainingDepositNGN({ depositRequiredNGN: 700_000, confirmedNGN: 700_000 }) === 0, "deposit option hides at 0");

  const publicPayload = {
    invoiceNumber: "INV-1",
    addresseeName: "Ada",
    pieceLabel: "Gown",
  };
  assert(publicInvoiceOmitsClientRecord(publicPayload), "public invoice DTO has no client record fields");
  assert(
    publicInvoiceOmitsClientRecord({ ...publicPayload, clientEmail: "hidden@example.com" }) === false,
    "email on the payload fails the PII check",
  );

  const adminUpload = readFileSync(
    resolve("src/app/api/admin/consultations/upload/route.ts"),
    "utf8",
  );
  assert(!adminUpload.includes("rejectIfAtelierBookingsClosed"), "admin moodboard route is not gated by bookings flag");
  assert(adminUpload.includes("gateUploadFolder"), "admin moodboard uses the authenticated folder gate");

  const publicUpload = readFileSync(resolve("src/app/api/consultations/upload/route.ts"), "utf8");
  assert(publicUpload.includes("rejectIfAtelierBookingsClosed"), "public consultation upload stays gated");

  const privateUrl = "/media/private/prudential-atelier/consultations/ref.jpg";
  assert(
    adminReceiptSrc(privateUrl).startsWith("/api/admin/media/file/"),
    "private stills rewrite through adminReceiptSrc",
  );

  const invoicePay = readFileSync(resolve("src/app/api/invoice/[token]/pay/route.ts"), "utf8");
  assert(!invoicePay.includes("await auth()"), "public invoice pay does not require a session");
  const invoiceBank = readFileSync(resolve("src/app/api/invoice/[token]/bank-transfer/route.ts"), "utf8");
  assert(!invoiceBank.includes("await auth()"), "public invoice bank transfer does not require a session");
  const invoiceReceipt = readFileSync(resolve("src/app/api/invoice/[token]/receipt/route.ts"), "utf8");
  assert(invoiceReceipt.includes("allowHeic: true") || invoiceReceipt.includes("allowHeic"), "token receipt upload allows HEIC");

  const notes = intakeStageNotes({
    bookingNumber: "CB-1001",
    quoteRef: "QT-2026-0001",
    invoiceNumber: "INV-2026-0001",
    consultationPaid: true,
    consultationPaymentRef: "PSK_abc",
  });
  assert(INTAKE_STAGES.length === 4, "convert records stages 1–4");
  assert(notes.CONSULTATION_BOOKING.includes("CB-1001"), "stage 1 names the booking");
  assert(notes.INVOICE_ISSUANCE.includes("INV-2026-0001"), "stage 3 names the invoice");
  assert(notes.PAYMENT_CONFIRMATION.includes("PSK_abc"), "stage 4 names the consultation payment");
  assert(notes.PAYMENT_CONFIRMATION.toLowerCase().includes("deposit is still due"), "stage 4 is not the commission deposit");

  const completions = [
    { stage: BespokeStage.CONSULTATION_BOOKING, revertedAt: null },
    { stage: BespokeStage.CONSULTATION_SESSION, revertedAt: null },
    { stage: BespokeStage.INVOICE_ISSUANCE, revertedAt: null },
    { stage: BespokeStage.PAYMENT_CONFIRMATION, revertedAt: null },
    { stage: BespokeStage.SKETCHING_CONCEPT, revertedAt: null },
    { stage: BespokeStage.FABRIC_SOURCING, revertedAt: new Date() },
    { stage: BespokeStage.DESIGN_APPROVAL, revertedAt: new Date() },
  ];
  const live = liveCompletionStages(completions);
  assert(countLiveCompletions(live) === 5, "/13 counter uses live completions only");
  assert(isLiveStageDone(BespokeStage.SKETCHING_CONCEPT, live), "unreverted stage is complete");
  assert(!isLiveStageDone(BespokeStage.FABRIC_SOURCING, live), "reverted stage is not complete for the client");
  assert(!isLiveStageDone(BespokeStage.DESIGN_APPROVAL, live), "later reverted stage is not shown as done");

  const history = [
    { stage: BespokeStage.SKETCHING_CONCEPT, notes: "sketches" },
    { stage: BespokeStage.FABRIC_SOURCING, notes: "silk" },
    { stage: BespokeStage.DESIGN_APPROVAL, notes: "approved" },
  ];
  const visible = stageHistoryForLiveCompletions(history, live);
  assert(visible.length === 1 && visible[0]?.stage === BespokeStage.SKETCHING_CONCEPT, "tracker hides superseded later updates");

  const tracker = readFileSync(resolve("src/components/bespoke/BespokeStageTracker.tsx"), "utf8");
  assert(!tracker.includes("idx < currentIdx"), "tracker no longer treats currentStage index as completion");

  const convertSrc = readFileSync(resolve("src/lib/quotation-convert.ts"), "utf8");
  assert(convertSrc.includes("currentStage: BespokeStage.SKETCHING_CONCEPT"), "convert starts production at sketching");
  assert(convertSrc.includes("INTAKE_STAGES"), "convert writes stages 1–4");
  assert(convertSrc.includes("orderStageCompletion.create"), "convert writes live completions, not only StageUpdate");

  console.log("slice-ai: ok");
}

run();
