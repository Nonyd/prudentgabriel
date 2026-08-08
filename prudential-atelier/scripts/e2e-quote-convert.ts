/**
 * Full creation-path E2E on an empty ledger DB (sprint-a-purge-demo).
 *
 * consultation → complete → quotation → approve → convert → deposit
 * → productionUnlockedAt + quotationId.
 *
 * Refuses the production Neon host. Does not send real email (no SMTP/Resend).
 *
 *   DATABASE_URL=<purge-branch> pnpm exec tsx scripts/e2e-quote-convert.ts
 */
import {
  ConsultationStatus,
  Currency,
  PaymentGateway,
  PaymentMethod,
  PaymentPurpose,
  PaymentStatus,
  QuoteStatus,
} from "@prisma/client";
import { looksLikeProductionDatabase } from "./fixture-guard";
import { prisma } from "../src/lib/prisma";
import { generateBookingNumber } from "../src/lib/consultation";
import { generateQuoteRef } from "../src/lib/bespoke-stages";
import { fulfillPaidConsultationBooking } from "../src/lib/consultation-payment";
import { convertQuotationToOrder } from "../src/lib/quotation-convert";
import {
  appendPayment,
  getBespokeDepositPercent,
  getInvoicePaymentSummary,
  getLegacyFallbackHitCount,
  getOrderPaymentSummary,
  resolveClientId,
} from "../src/lib/payments/ledger";
import { generatePaymentReference } from "../src/lib/payments/index";

const CLIENT = {
  name: "E2E Quote Convert Client",
  email: "e2e.quote.convert@example.com",
  phone: "+2348010000001",
};

const GOWN_TOTAL = 500_000;

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`E2E FAIL: ${message}`);
}

function nearly(a: number, b: number, eps = 0.02): boolean {
  return Math.abs(a - b) <= eps;
}

async function cleanupE2eRows(): Promise<void> {
  const email = CLIENT.email;
  const bookings = await prisma.consultationBooking.findMany({
    where: { clientEmail: email },
    select: { id: true },
  });
  const bookingIds = bookings.map((b) => b.id);
  const quotes = await prisma.quotation.findMany({
    where: { OR: [{ clientEmail: email }, { consultationId: { in: bookingIds } }] },
    select: { id: true },
  });
  const quoteIds = quotes.map((q) => q.id);
  const orders = await prisma.bespokeOrder.findMany({
    where: {
      OR: [
        { clientEmail: email },
        { quotationId: { in: quoteIds } },
        { consultationId: { in: bookingIds } },
      ],
    },
    select: { id: true },
  });
  const orderIds = orders.map((o) => o.id);
  const invoices = await prisma.invoice.findMany({
    where: {
      OR: [
        { clientEmail: email },
        { quotationId: { in: quoteIds } },
        { consultationId: { in: bookingIds } },
      ],
    },
    select: { id: true },
  });
  const invoiceIds = invoices.map((i) => i.id);

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.ledger_bypass = 'on'`);
    if (orderIds.length || invoiceIds.length || bookingIds.length) {
      await tx.payment.deleteMany({
        where: {
          OR: [
            { bespokeOrderId: { in: orderIds } },
            { invoiceId: { in: invoiceIds } },
            { consultationId: { in: bookingIds } },
          ],
        },
      });
    }
    if (invoiceIds.length) await tx.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
    if (orderIds.length) await tx.bespokeOrder.deleteMany({ where: { id: { in: orderIds } } });
    if (quoteIds.length) await tx.quotation.deleteMany({ where: { id: { in: quoteIds } } });
    if (bookingIds.length) await tx.consultationBooking.deleteMany({ where: { id: { in: bookingIds } } });

    const user = await tx.user.findUnique({ where: { email }, select: { id: true } });
    if (user) {
      await tx.clientProfile.deleteMany({ where: { userId: user.id } });
      await tx.user.delete({ where: { id: user.id } }).catch(() => undefined);
    }
  });
}

async function uniqueQuoteRef(): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const quoteRef = generateQuoteRef();
    const exists = await prisma.quotation.findUnique({ where: { quoteRef } });
    if (!exists) return quoteRef;
  }
  return generateQuoteRef();
}

async function main() {
  if (looksLikeProductionDatabase()) {
    throw new Error("e2e-quote-convert: refused — DATABASE_URL points at production.");
  }

  const host = (() => {
    try {
      return new URL((process.env.DATABASE_URL ?? "").replace(/^prisma\+/, "")).hostname;
    } catch {
      return "(unparsed)";
    }
  })();
  console.log(`E2E host: ${host}`);

  const offering = await prisma.consultantOffering.findFirst({
    where: {
      consultantId: "consultant-prudent",
      sessionType: "BESPOKE_DESIGN",
      isActive: true,
      consultant: { isActive: true },
    },
    include: { consultant: true },
  });
  assert(offering, "flagship BESPOKE_DESIGN offering missing");

  const depositPercent = await getBespokeDepositPercent();
  const expectedDeposit = Math.round(GOWN_TOTAL * (depositPercent / 100) * 100) / 100;
  console.log(`Deposit %: ${depositPercent} → required ₦${expectedDeposit.toLocaleString("en-NG")}`);

  await cleanupE2eRows();

  const preferred = new Date();
  preferred.setDate(preferred.getDate() + 10);

  const booking = await prisma.consultationBooking.create({
    data: {
      bookingNumber: generateBookingNumber(),
      offeringId: offering.id,
      consultantId: offering.consultantId,
      clientName: CLIENT.name,
      clientEmail: CLIENT.email,
      clientPhone: CLIENT.phone,
      clientCountry: "NG",
      occasion: "Wedding guest",
      description: "E2E: floor-length evening gown after consultation.",
      referenceImages: [],
      preferredDate1: preferred,
      offeringType: "PHYSICAL_PRUDENT_TEAM",
      feeNGN: offering.feeNGN,
      currency: Currency.NGN,
      paymentGateway: PaymentGateway.BANK_TRANSFER,
      paymentRef: generatePaymentReference("CONSULT"),
      paymentStatus: PaymentStatus.PENDING,
      status: ConsultationStatus.PENDING_PAYMENT,
    },
  });
  console.log(`1. Booked ${booking.bookingNumber} (${booking.id}) status=${booking.status}`);

  try {
    const paid = await fulfillPaidConsultationBooking({
      bookingId: booking.id,
      paymentRef: booking.paymentRef ?? generatePaymentReference("CONSULT"),
      gateway: PaymentGateway.BANK_TRANSFER,
    });
    assert(paid, "fulfillPaidConsultationBooking returned false");
  } catch (e) {
    // tsx does not inject React for email JSX; production Next compile does.
    // The booking row is updated before emails fire — assert on DB state below.
    console.warn(
      "fulfillPaidConsultationBooking side-effect error (email/onboard):",
      e instanceof Error ? e.message : e,
    );
  }

  const afterPay = await prisma.consultationBooking.findUnique({ where: { id: booking.id } });
  assert(afterPay, "booking vanished after pay");
  assert(afterPay.paymentStatus === PaymentStatus.PAID, `paymentStatus=${afterPay.paymentStatus}`);
  assert(
    afterPay.status === ConsultationStatus.PENDING_CONFIRMATION ||
      afterPay.status === ConsultationStatus.CONFIRMED,
    `unexpected post-pay status=${afterPay.status}`,
  );
  console.log(`2. Paid consultation → status=${afterPay.status} payment=${afterPay.paymentStatus}`);

  const confirmedDate = new Date(Date.UTC(2026, 7, 20, 0, 0, 0, 0));
  await prisma.consultationBooking.update({
    where: { id: booking.id },
    data: {
      status: ConsultationStatus.CONFIRMED,
      confirmedDate,
      confirmedTime: "11:00",
      confirmedAt: new Date(),
      sessionNotes: "E2E session: emerald silk, floor length, low back.",
      moodboardImages: [],
    },
  });
  await prisma.consultationBooking.update({
    where: { id: booking.id },
    data: {
      status: ConsultationStatus.COMPLETED,
      completedAt: new Date(),
      adminFeedback: "E2E complete — proceed to quotation.",
    },
  });
  const completed = await prisma.consultationBooking.findUnique({ where: { id: booking.id } });
  assert(completed?.status === ConsultationStatus.COMPLETED, `status=${completed?.status}`);
  assert(completed.completedAt, "completedAt not set");
  console.log(`3. Completed consultation at ${completed.completedAt.toISOString()}`);

  const quoteRef = await uniqueQuoteRef();
  const lineItems = [
    {
      description: "Bespoke evening gown — emerald silk",
      quantity: 1,
      unitPrice: GOWN_TOTAL,
      total: GOWN_TOTAL,
    },
  ];
  const quote = await prisma.quotation.create({
    data: {
      quoteRef,
      clientName: CLIENT.name,
      clientEmail: CLIENT.email,
      clientPhone: CLIENT.phone,
      lineItems,
      subtotal: GOWN_TOTAL,
      tax: 0,
      discount: 0,
      total: GOWN_TOTAL,
      notes: "E2E quotation linked to completed consultation.",
      consultationId: booking.id,
      status: QuoteStatus.SENT,
      sentAt: new Date(),
      createdBy: "e2e-quote-convert",
    },
  });
  console.log(`4. Created quotation ${quote.quoteRef} consultationId=${quote.consultationId}`);

  const approved = await prisma.quotation.update({
    where: { id: quote.id },
    data: { status: QuoteStatus.APPROVED, approvedAt: new Date() },
  });
  assert(approved.status === QuoteStatus.APPROVED, `approve status=${approved.status}`);
  console.log(`5. Client approved ${approved.quoteRef}`);

  const converted = await convertQuotationToOrder(approved, "e2e-quote-convert");
  console.log(
    `6. Converted → order ${converted.orderRef} / invoice ${converted.invoiceNumber}`,
  );

  const [order, invoice, quoteAfter] = await Promise.all([
    prisma.bespokeOrder.findUnique({ where: { id: converted.orderId } }),
    prisma.invoice.findUnique({ where: { id: converted.invoiceId } }),
    prisma.quotation.findUnique({ where: { id: quote.id } }),
  ]);
  assert(order, "order missing after convert");
  assert(invoice, "invoice missing after convert");
  assert(quoteAfter?.status === QuoteStatus.CONVERTED, `quote status=${quoteAfter?.status}`);
  assert(order.quotationId === quote.id, `order.quotationId=${order.quotationId} expected ${quote.id}`);
  assert(invoice.quotationId === quote.id, `invoice.quotationId=${invoice.quotationId} expected ${quote.id}`);
  assert(
    order.consultationId === booking.id,
    `order.consultationId=${order.consultationId} expected ${booking.id}`,
  );
  assert(
    invoice.consultationId === booking.id,
    `invoice.consultationId=${invoice.consultationId} expected ${booking.id}`,
  );
  assert(nearly(invoice.total, GOWN_TOTAL), `invoice.total=${invoice.total}`);
  assert(
    nearly(invoice.depositRequired, expectedDeposit),
    `invoice.depositRequired=${invoice.depositRequired} expected ${expectedDeposit}`,
  );
  assert(!order.productionUnlockedAt, "productionUnlockedAt set before deposit");
  console.log(
    `   quotationId populated on order+invoice; depositRequired=₦${invoice.depositRequired.toLocaleString("en-NG")}`,
  );

  const clientId = await resolveClientId({ email: invoice.clientEmail });
  const payRef = generatePaymentReference("INV");
  await appendPayment({
    reference: payRef,
    amount: invoice.depositRequired,
    currency: invoice.currency,
    method: PaymentMethod.BANK_TRANSFER,
    status: PaymentStatus.CONFIRMED,
    purpose: PaymentPurpose.DEPOSIT,
    invoiceId: invoice.id,
    bespokeOrderId: order.id,
    clientId,
    confirmedAt: new Date(),
  });
  console.log(`7. Confirmed deposit ${payRef} ₦${invoice.depositRequired.toLocaleString("en-NG")}`);

  const [orderPaid, invoicePaid, payment, orderSummary, invoiceSummary] = await Promise.all([
    prisma.bespokeOrder.findUnique({ where: { id: order.id } }),
    prisma.invoice.findUnique({ where: { id: invoice.id } }),
    prisma.payment.findUnique({ where: { reference: payRef } }),
    getOrderPaymentSummary(order.id),
    getInvoicePaymentSummary(invoice.id),
  ]);
  assert(orderPaid, "order missing after deposit");
  assert(invoicePaid, "invoice missing after deposit");
  assert(payment, "Payment row missing");
  assert(payment.status === PaymentStatus.CONFIRMED, `payment.status=${payment.status}`);
  assert(payment.purpose === PaymentPurpose.DEPOSIT, `payment.purpose=${payment.purpose}`);
  assert(payment.invoiceId === invoice.id, "payment.invoiceId mismatch");
  assert(payment.bespokeOrderId === order.id, "payment.bespokeOrderId mismatch");
  assert(orderPaid.productionUnlockedAt, "productionUnlockedAt was NOT set after deposit");
  assert(nearly(orderPaid.amountPaid, expectedDeposit), `amountPaid=${orderPaid.amountPaid}`);
  assert(nearly(invoicePaid.depositPaid, expectedDeposit), `depositPaid=${invoicePaid.depositPaid}`);
  assert(invoicePaid.status === "PARTIALLY_PAID", `invoice.status=${invoicePaid.status}`);
  assert(orderSummary.depositSatisfied, "order summary depositSatisfied=false");
  assert(!orderSummary.usedLegacyFallback, "order hit LEGACY_NO_LEDGER_ROWS");
  assert(!invoiceSummary.usedLegacyFallback, "invoice hit LEGACY_NO_LEDGER_ROWS");
  assert(getLegacyFallbackHitCount() === 0, `legacy hits=${getLegacyFallbackHitCount()}`);

  console.log("\n=== E2E PASS ===");
  console.log(
    JSON.stringify(
      {
        bookingNumber: booking.bookingNumber,
        quoteRef: quote.quoteRef,
        orderRef: orderPaid.orderRef,
        invoiceNumber: invoicePaid.invoiceNumber,
        quotationId: orderPaid.quotationId,
        invoiceQuotationId: invoicePaid.quotationId,
        consultationId: orderPaid.consultationId,
        productionUnlockedAt: orderPaid.productionUnlockedAt?.toISOString() ?? null,
        amountPaid: orderPaid.amountPaid,
        depositPaid: invoicePaid.depositPaid,
        depositRequired: invoicePaid.depositRequired,
        paymentReference: payment.reference,
        legacyHits: getLegacyFallbackHitCount(),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
