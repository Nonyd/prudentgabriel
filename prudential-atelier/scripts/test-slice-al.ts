/**
 * Slice AL — the money she sees: kobo rounding, deposit tolerance, invoice pay UI.
 *
 *   pnpm test:slice-al
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { documentAmountToNGN, remainingDepositNGN } from "../src/lib/atelier-fx";
import {
  invoiceIssuanceNote,
  intakeNotesMatchPaymentState,
  paymentConfirmationNote,
} from "../src/lib/atelier/intake-stages";
import { type LockedFx } from "../src/lib/fx";
import {
  amountForPayOption,
  currenciesWithMethods,
  defaultPayCurrency,
  invoicePayFigures,
} from "../src/lib/invoice-pay-options";
import { measurementPlausibilityError } from "../src/lib/measurements";
import { DEPOSIT_SATISFACTION_TOLERANCE_NGN, depositIsSatisfied, roundToKobo } from "../src/lib/money";
import { paystackCheckoutTotalNGN, paystackLocalFeeNGN } from "../src/lib/payments/paystack-fee";

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
  const converted = documentAmountToNGN(4800, "GBP", fx);
  assert(converted === roundToKobo(converted), "FX-converted total is stored to kobo");
  assert(String(converted).split(".")[1]?.length ?? 0 <= 2, "no fraction of a kobo on a converted total");
  assert(converted === 9_230_769.23, `£4,800 at 0.00052 is ₦9,230,769.23, got ${converted}`);

  const depositRequired = roundToKobo(3360 / fx.gbpRate);
  const paidKobo = 6_461_538;
  assert(depositRequired === 6_461_538.46, `70% of the pound invoice converts to ₦6,461,538.46, got ${depositRequired}`);
  assert(!depositIsSatisfied(paidKobo, depositRequired, 0), "zero tolerance still finds her ₦0.46 short");
  assert(
    depositIsSatisfied(paidKobo, depositRequired, DEPOSIT_SATISFACTION_TOLERANCE_NGN),
    "a ₦0.46 shortfall is within the ₦1 kobo tolerance",
  );
  assert(remainingDepositNGN({ depositRequiredNGN: depositRequired, confirmedNGN: paidKobo }) === 0, "remaining deposit hides once the gate is satisfied");
  assert(!depositIsSatisfied(paidKobo - 2, depositRequired), "₦2.46 short does not unlock — the gate is not loosened");

  const emptyGbp = currenciesWithMethods({ NGN: ["PAYSTACK"], USD: [], GBP: [] });
  assert(JSON.stringify(emptyGbp) === JSON.stringify(["NGN"]), "GBP with no method is not offered");
  assert(defaultPayCurrency("GBP", emptyGbp) === "NGN", "a pound invoice defaults to naira when that is the only method");
  assert(defaultPayCurrency("GBP", []) === null, "no currency is offered when nothing can collect");

  const paySrc = readFileSync(resolve("src/components/invoice/PublicInvoicePayClient.tsx"), "utf8");
  assert(paySrc.includes("availableCurrencies"), "public invoice pay renders only currencies that have a method");
  assert(!paySrc.includes('(["NGN", "USD", "GBP"]'), "public invoice does not hardcode three currency buttons");
  const viewSrc = readFileSync(resolve("src/components/invoice/PublicInvoiceView.tsx"), "utf8");
  assert(viewSrc.includes("bank.accountNumber"), "empty bank block is not rendered");

  const afterPartial = invoicePayFigures({
    remainingDepositNGN: 0,
    remainingBalanceNGN: 2_769_231.23,
  });
  assert(!afterPartial.showDeposit, "deposit radio hides after the deposit is satisfied");
  assert(amountForPayOption("full", afterPartial) === 2_769_231.23, "outstanding balance stays payable after a partial payment");
  assert(amountForPayOption("deposit", afterPartial) === 2_769_231.23, "with no deposit left, the only amount is the remaining balance");

  const whileDepositDue = invoicePayFigures({
    remainingDepositNGN: 6_461_538.46,
    remainingBalanceNGN: 9_230_769.23,
  });
  assert(whileDepositDue.showDeposit, "deposit radio shows while deposit remains");
  assert(amountForPayOption("deposit", whileDepositDue) === 6_461_538.46, "deposit radio shows the deposit, not the full balance");
  assert(amountForPayOption("full", whileDepositDue) === 9_230_769.23, "full radio shows the outstanding balance, not the deposit");

  const drafted = invoiceIssuanceNote({ invoiceNumber: "PA-INV-2026-0002", quoteRef: "QT-2026-0002", sent: false });
  const unpaid = paymentConfirmationNote({
    consultationPaid: true,
    consultationPaymentRef: "CB-26-02381",
    depositSatisfied: false,
  });
  assert(intakeNotesMatchPaymentState({ invoiceNote: drafted, paymentNote: unpaid, invoiceSent: false, depositSatisfied: false }), "convert notes match a draft invoice and unpaid deposit");
  assert(drafted.toLowerCase().includes("draft"), "stage 3 says drafted");
  assert(unpaid.toLowerCase().includes("consultation fee"), "stage 4 is the consultation fee");
  assert(unpaid.toLowerCase().includes("deposit is still due"), "stage 4 does not claim the commission deposit");

  const sent = invoiceIssuanceNote({ invoiceNumber: "PA-INV-2026-0002", quoteRef: "QT-2026-0002", sent: true });
  const paid = paymentConfirmationNote({ consultationPaid: true, depositSatisfied: true });
  assert(intakeNotesMatchPaymentState({ invoiceNote: sent, paymentNote: paid, invoiceSent: true, depositSatisfied: true }), "sent invoice + received deposit do not contradict");
  assert(
    !intakeNotesMatchPaymentState({
      invoiceNote: drafted,
      paymentNote: unpaid,
      invoiceSent: true,
      depositSatisfied: true,
    }),
    "stale convert notes fail the contradiction check",
  );

  const labels = readFileSync(resolve("src/lib/bespoke-stages.ts"), "utf8");
  assert(labels.includes("Consultation Fee"), "stage 4 label is the consultation fee");
  assert(labels.includes("commission deposit is billed separately"), "client copy does not say the commission deposit is verified at stage 4");

  const fee = paystackLocalFeeNGN(6_461_538.46);
  assert(fee === 2_000, "Paystack local fee caps at ₦2,000");
  assert(paystackCheckoutTotalNGN(6_461_538.46) === 6_463_538.46, "checkout total is invoice plus the disclosed fee");
  const selectorSrc = readFileSync(resolve("src/components/checkout/PaymentMethodSelector.tsx"), "utf8");
  assert(selectorSrc.includes("paystackFeeCopy"), "Paystack fee is shown before handover on RTW and atelier");

  assert(measurementPlausibilityError({ bust: 24, waist: 32, hips: 43, unit: "inches" }), "bust 24″ / waist 32″ is refused");
  assert(measurementPlausibilityError({ bust: 38, waist: 30, hips: 42, unit: "inches" }) === null, "a plausible adult set is accepted");

  const convertSrc = readFileSync(resolve("src/lib/quotation-convert.ts"), "utf8");
  assert(convertSrc.includes("documentAmountToNGN"), "convert writes the NGN total through the kobo helper");
  const ledgerSrc = readFileSync(resolve("src/lib/payments/ledger.ts"), "utf8");
  assert(ledgerSrc.includes("depositIsSatisfied"), "deposit gate uses the kobo tolerance");
  assert(ledgerSrc.includes("toDecimalPlaces(2)"), "ledger compares at kobo");

  const welcomeSrc = readFileSync(resolve("src/components/invoice/PublicInvoicePayClient.tsx"), "utf8");
  assert(welcomeSrc.includes("creates a client account"), "guest invoice pay says an account will be created");

  const meetingSrc = readFileSync(resolve("src/emails/ConsultationMeetingLinkEmail.tsx"), "utf8");
  assert(!meetingSrc.includes("coming up soon"), "meeting-link email no longer reads as imminent");
  assert(meetingSrc.includes("fmtDate(confirmedDate)"), "meeting-link email says when the call is");

  console.log("slice-al: ok");
}

run();
