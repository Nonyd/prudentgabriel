/**
 * Slice AA: finance reports from the Payment ledger.
 *
 *   pnpm test:slice-aa
 */
import "./preload-test-env";
import {
  OrderStatus,
  PaymentMethod,
  PaymentPurpose,
  PaymentStatus,
  ProductCategory,
  ProductType,
  Role,
} from "@prisma/client";
import {
  classifyPayments,
  combinedTotals,
  resolveBusinessLine,
  totalsFor,
  type FinanceOrderSnap,
  type FinancePaymentSnap,
} from "../src/lib/finance/classify";
import { AA0_LINES } from "../src/lib/finance/aa0";
import { LEDGER_HEADERS, ledgerRow } from "../src/lib/finance/export-rows";
import { customRange, financeRange, inRange } from "../src/lib/finance/period";
import { buildFinanceReport, linesInRange, reportFromLines } from "../src/lib/finance/query";
import { toCsv, toExcelXml } from "../src/lib/finance/spreadsheet";
import { prisma } from "../src/lib/prisma";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const stamp = `aa-${Date.now()}`;
const sept = new Date("2026-09-04T10:00:00+01:00");
const dec = new Date("2026-12-02T10:00:00+01:00");

function orderSnap(over: Partial<FinanceOrderSnap> = {}): FinanceOrderSnap {
  return {
    orderNumber: "PG-TEST",
    shippingAmount: 0,
    total: 100_000,
    currency: "NGN",
    fxRateLocked: null,
    fxGbpRateLocked: null,
    fxUsdAmountLocked: null,
    status: "CONFIRMED",
    paymentStatus: PaymentStatus.PAID,
    refundRecordedAt: null,
    ...over,
  };
}

function snap(over: Partial<FinancePaymentSnap> & Pick<FinancePaymentSnap, "id" | "amount">): FinancePaymentSnap {
  return {
    reference: over.id,
    currency: "NGN",
    method: PaymentMethod.PAYSTACK,
    status: PaymentStatus.CONFIRMED,
    purpose: PaymentPurpose.RTW_ORDER,
    confirmedAt: sept,
    createdAt: sept,
    confirmedByName: null,
    clientLabel: "Test",
    orderId: null,
    bespokeOrderId: null,
    invoiceId: null,
    consultationId: null,
    order: null,
    invoice: null,
    consultationRef: null,
    bespokeRef: null,
    ...over,
  };
}

function figures(lines: ReturnType<typeof classifyPayments>) {
  return {
    sales: totalsFor(lines).salesNGN,
    cash: totalsFor(lines).cashNGN,
    points: totalsFor(lines).pointsNGN,
    shipping: totalsFor(lines).shippingCollectedNGN,
    liability: totalsFor(lines).liabilityNGN,
    vat: totalsFor(lines).vatNGN,
  };
}

function runPure() {
  assert(AA0_LINES.length === 4, "AA0 states basis, VAT, currency, and access");
  assert(AA0_LINES[0].title === "Cash basis", "cash basis is stated first");
  assert(AA0_LINES[1].title === "VAT", "VAT is stated");
  assert(AA0_LINES[2].title === "Reporting currency", "naira reporting is stated");
  assert(AA0_LINES[3].title === "Who can open this", "access is stated");

  const pointsPaid = classifyPayments([
    snap({
      id: "pts",
      amount: 80_000,
      method: PaymentMethod.POINTS,
      purpose: PaymentPurpose.POINTS_REDEMPTION,
      orderId: "o-pts",
      order: orderSnap({ orderNumber: "PG-PTS", total: 80_000 }),
    }),
  ]);
  assert(pointsPaid[0].cashNGN === 0, `points-paid cash must be 0, got ${pointsPaid[0].cashNGN}`);
  assert(pointsPaid[0].salesNGN === 80_000, "points-paid still has a sales value");
  assert(pointsPaid[0].pointsNGN === 80_000, "points redeemed are a third column");

  const shipped = classifyPayments([
    snap({
      id: "ship",
      amount: 145_000,
      orderId: "o-ship",
      order: orderSnap({ orderNumber: "PG-SHIP", shippingAmount: 45_000, total: 145_000 }),
    }),
  ]);
  assert(shipped[0].shippingCollectedNGN === 45_000, `shipping collected ${shipped[0].shippingCollectedNGN}`);
  assert(shipped[0].salesNGN === 100_000, `sales excludes shipping, got ${shipped[0].salesNGN}`);
  assert(shipped[0].cashNGN === 145_000, "cash includes the shipping pass-through");

  const pendingRefund = classifyPayments([
    snap({
      id: "liab",
      amount: 55_000,
      orderId: "o-liab",
      order: orderSnap({
        orderNumber: "PG-LIAB",
        status: "CANCELLED",
        paymentStatus: PaymentStatus.PAID,
        refundRecordedAt: null,
        total: 55_000,
      }),
    }),
  ]);
  assert(pendingRefund[0].liabilityNGN === 55_000, "PAID + CANCELLED is a liability until the refund stamp");
  assert(pendingRefund[0].salesNGN === 0, "pending oversell refund is not income");
  assert(pendingRefund[0].cashNGN === 0, "pending oversell refund is not cash income");

  const refunded = classifyPayments([
    snap({
      id: "liab-done",
      amount: 55_000,
      orderId: "o-liab-done",
      order: orderSnap({
        orderNumber: "PG-LIAB-DONE",
        status: "CANCELLED",
        paymentStatus: PaymentStatus.PAID,
        refundRecordedAt: new Date("2026-09-10T10:00:00+01:00"),
        total: 55_000,
      }),
    }),
  ]);
  assert(refunded[0].liabilityNGN === 0, "once refundRecordedAt is set it is no longer a liability");
  assert(refunded[0].salesNGN === 0, "a recorded refund does not turn the original row into a sale");

  const sepPay = snap({
    id: "first",
    amount: 100_000,
    orderId: "o-quote",
    confirmedAt: sept,
    createdAt: sept,
    order: orderSnap({ orderNumber: "PG-QUOTE", shippingAmount: 45_000, total: 145_000 }),
  });
  const laterPay = snap({
    id: "later",
    amount: 45_000,
    orderId: "o-quote",
    confirmedAt: dec,
    createdAt: dec,
    order: sepPay.order,
  });
  const classifiedQuote = classifyPayments([sepPay, laterPay]);
  const septRange = customRange("2026-09-01", "2026-09-30");
  const septLines = linesInRange(classifiedQuote, septRange.from, septRange.to);
  assert(septLines.length === 1, "December shipping top-up is outside September");
  assert(septLines[0].salesNGN === 100_000, `sibling quote keeps September sales at 100000, got ${septLines[0].salesNGN}`);
  assert(septLines[0].shippingCollectedNGN === 0, "first payment was garment; later row is the shipping");

  const rtwRow = snap({
    id: "rtw",
    amount: 120_000,
    orderId: "o-rtw",
    order: orderSnap({ orderNumber: "PG-RTW", total: 120_000 }),
  });
  const atelierRow = snap({
    id: "atel",
    amount: 80_000,
    purpose: PaymentPurpose.DEPOSIT,
    method: PaymentMethod.BANK_TRANSFER,
    bespokeOrderId: "b1",
    bespokeRef: "AT-1",
  });
  const consultRow = snap({
    id: "cons",
    amount: 25_000,
    purpose: PaymentPurpose.CONSULTATION,
    consultationId: "c1",
    consultationRef: "CB-1",
  });
  const neitherRow = snap({ id: "none", amount: 10_000, purpose: PaymentPurpose.FULL });
  const bothRow = snap({
    id: "both",
    amount: 10_000,
    orderId: "o-both",
    bespokeOrderId: "b-both",
    order: orderSnap(),
  });
  const mixed = classifyPayments([rtwRow, atelierRow, consultRow, neitherRow, bothRow]);
  assert(resolveBusinessLine(consultRow).businessLine === "ATELIER", "consultation is Atelier");
  assert(mixed.find((l) => l.id === "cons")?.atelierKind === "consultation", "consultation is its own Atelier purpose");
  assert(mixed.find((l) => l.id === "cons")?.purposeLabel === "Consultation", "consultation is not folded into commission");
  assert(mixed.find((l) => l.id === "atel")?.purposeLabel === "Deposit", "atelier deposit is labelled Deposit");
  assert(mixed.find((l) => l.id === "none")?.resolution === "neither", "orphan payment is neither line");
  assert(mixed.find((l) => l.id === "both")?.resolution === "both", "double-keyed payment is both");

  const rtw = totalsFor(mixed, "RTW");
  const atelier = totalsFor(mixed, "ATELIER");
  const combined = combinedTotals(mixed);
  assert(combined.cashNGN === rtw.cashNGN + atelier.cashNGN, "RTW + Atelier cash equals combined");
  assert(combined.salesNGN === rtw.salesNGN + atelier.salesNGN, "RTW + Atelier sales equals combined");
  assert(combined.cashNGN === 225_000, `combined cash excludes unassigned, got ${combined.cashNGN}`);
  assert(neitherRow.amount + bothRow.amount === 20_000, "unassigned rows exist");
  const unassignedCash = mixed.filter((l) => l.businessLine === "UNASSIGNED").reduce((s, l) => s + l.cashNGN, 0);
  assert(unassignedCash === 20_000, "neither and both are kept out of the combined total");

  const vatInv = classifyPayments([
    snap({
      id: "vat",
      amount: 107_500,
      purpose: PaymentPurpose.FULL,
      invoiceId: "inv1",
      invoice: {
        invoiceNumber: "INV-1",
        total: 107_500,
        vatAmount: 7_500,
        vatEnabled: true,
        currency: "NGN",
        exchangeRate: 1,
      },
    }),
  ]);
  assert(vatInv[0].vatNGN === 7_500, `VAT broken out, got ${vatInv[0].vatNGN}`);
  assert(vatInv[0].salesNGN === 100_000, "sales is exclusive of VAT");

  const usd = classifyPayments([
    snap({
      id: "usd",
      amount: 100_000,
      currency: "USD",
      orderId: "o-usd",
      order: orderSnap({ currency: "USD", fxRateLocked: 0.00065, total: 100_000 }),
    }),
  ]);
  assert(usd[0].amountNGN === 100_000, "RTW ledger amount is already naira");
  assert(usd[0].originalAmount === 65, `original USD shown beside naira, got ${usd[0].originalAmount}`);
  assert(usd[0].currency === "USD", "original currency is not dropped");

  const reportA = reportFromLines(mixed, septRange.from, septRange.to);
  const reportB = reportFromLines(mixed, septRange.from, septRange.to);
  assert(JSON.stringify(reportA.rtw) === JSON.stringify(reportB.rtw), "re-run returns identical RTW figures");
  assert(JSON.stringify(reportA.atelier) === JSON.stringify(reportB.atelier), "re-run returns identical Atelier figures");
  assert(JSON.stringify(reportA.combined) === JSON.stringify(reportB.combined), "re-run returns identical combined figures");
  assert(
    JSON.stringify(reportA.lines.map(ledgerRow)) === JSON.stringify(reportB.lines.map(ledgerRow)),
    "re-run returns identical ledger rows",
  );

  const csv = toCsv(LEDGER_HEADERS, reportA.lines.map(ledgerRow));
  assert(csv.startsWith("\uFEFF"), "CSV has a BOM so Excel opens it");
  assert(csv.includes("Sales (NGN)"), "CSV carries the sales column");
  const xls = toExcelXml("Ledger", LEDGER_HEADERS, reportA.lines.map(ledgerRow));
  assert(xls.includes("Excel.Sheet"), "Excel export is a workbook Excel can open");

  const month = financeRange("month", new Date("2026-09-15T12:00:00+01:00"));
  assert(inRange(sept, month.from, month.to), "4 September sits in September");
  assert(!inRange(dec, month.from, month.to), "December is outside September");

  void figures(shipped);
}

async function runDb() {
  const user = await prisma.user.create({
    data: { email: `${stamp}@sliceaa.test`, name: "Slice AA", role: Role.CUSTOMER },
  });
  const product = await prisma.product.create({
    data: {
      name: `AA Dress ${stamp}`,
      slug: `aa-dress-${stamp}`,
      description: "test",
      category: ProductCategory.FORMAL,
      type: ProductType.RTW,
      priceNGN: 100_000,
      basePriceNGN: 100_000,
      isPublished: true,
    },
  });

  const rtw = await prisma.order.create({
    data: {
      orderNumber: `AA-RTW-${stamp}`,
      userId: user.id,
      subtotal: 100_000,
      shippingAmount: 45_000,
      total: 145_000,
      paymentStatus: PaymentStatus.PAID,
      status: OrderStatus.CONFIRMED,
      paidAt: sept,
      items: {
        create: {
          productId: product.id,
          quantity: 1,
          size: "12",
          price: 100_000,
          lineTotal: 100_000,
        },
      },
    },
  });
  const pointsOrder = await prisma.order.create({
    data: {
      orderNumber: `AA-PTS-${stamp}`,
      userId: user.id,
      subtotal: 80_000,
      total: 80_000,
      pointsDiscountNGN: 80_000,
      pointsUsed: 80_000,
      paymentStatus: PaymentStatus.PAID,
      status: OrderStatus.CONFIRMED,
      paidAt: sept,
    },
  });
  const cancelled = await prisma.order.create({
    data: {
      orderNumber: `AA-CXL-${stamp}`,
      userId: user.id,
      subtotal: 55_000,
      total: 55_000,
      paymentStatus: PaymentStatus.PAID,
      status: OrderStatus.CANCELLED,
      paidAt: sept,
    },
  });
  const atelier = await prisma.bespokeOrder.create({
    data: {
      orderRef: `AA-AT-${stamp}`,
      clientName: "Atelier Client",
      clientEmail: `atelier+${stamp}@sliceaa.test`,
      clientPhone: "+2348000000001",
      outfitDescription: "Slice AA commission",
      totalAmount: 80_000,
      amountPaid: 0,
      balance: 80_000,
    },
  });

  await prisma.payment.createMany({
    data: [
      {
        reference: `AA-RTW-${stamp}`,
        amount: 145_000,
        currency: "NGN",
        method: PaymentMethod.PAYSTACK,
        status: PaymentStatus.CONFIRMED,
        purpose: PaymentPurpose.RTW_ORDER,
        orderId: rtw.id,
        clientId: user.id,
        confirmedAt: sept,
        createdAt: sept,
      },
      {
        reference: `AA-PTS-${stamp}`,
        amount: 80_000,
        currency: "NGN",
        method: PaymentMethod.POINTS,
        status: PaymentStatus.CONFIRMED,
        purpose: PaymentPurpose.POINTS_REDEMPTION,
        orderId: pointsOrder.id,
        clientId: user.id,
        confirmedAt: sept,
        createdAt: sept,
      },
      {
        reference: `AA-CXL-${stamp}`,
        amount: 55_000,
        currency: "NGN",
        method: PaymentMethod.PAYSTACK,
        status: PaymentStatus.CONFIRMED,
        purpose: PaymentPurpose.RTW_ORDER,
        orderId: cancelled.id,
        clientId: user.id,
        confirmedAt: sept,
        createdAt: sept,
      },
      {
        reference: `AA-AT-${stamp}`,
        amount: 80_000,
        currency: "NGN",
        method: PaymentMethod.BANK_TRANSFER,
        status: PaymentStatus.CONFIRMED,
        purpose: PaymentPurpose.DEPOSIT,
        bespokeOrderId: atelier.id,
        clientId: `email:atelier+${stamp}@sliceaa.test`,
        confirmedAt: sept,
        createdAt: sept,
      },
    ],
  });

  const range = customRange("2026-09-01", "2026-09-30");
  const first = await buildFinanceReport(range.from, range.to);
  const ours = first.lines.filter((l) => l.reference.startsWith(`AA-`) && l.reference.endsWith(stamp));
  const pointsLine = ours.find((l) => l.reference === `AA-PTS-${stamp}`);
  const shipLine = ours.find((l) => l.reference === `AA-RTW-${stamp}`);
  const cxlLine = ours.find((l) => l.reference === `AA-CXL-${stamp}`);
  const atLine = ours.find((l) => l.reference === `AA-AT-${stamp}`);
  assert(pointsLine?.cashNGN === 0, "db: points-paid order shows zero cash received");
  assert(pointsLine?.pointsNGN === 80_000, "db: points redeemed are reported");
  assert(shipLine?.salesNGN === 100_000, `db: shipping excluded from sales, got ${shipLine?.salesNGN}`);
  assert(shipLine?.shippingCollectedNGN === 45_000, "db: shipping collected is a separate line");
  assert(cxlLine?.liabilityNGN === 55_000, "db: PAID + CANCELLED is a liability");
  assert(cxlLine?.salesNGN === 0, "db: pending refund is not a sale");
  assert(atLine?.businessLine === "ATELIER", "db: deposit is Atelier");
  assert(atLine?.purposeLabel === "Deposit", "db: deposit is not a finished commission");

  const scoped = ours;
  const rtwT = totalsFor(scoped, "RTW");
  const atelierT = totalsFor(scoped, "ATELIER");
  const combinedT = combinedTotals(scoped);
  assert(combinedT.cashNGN === rtwT.cashNGN + atelierT.cashNGN, "db: RTW + Atelier cash equals combined");
  assert(combinedT.salesNGN === rtwT.salesNGN + atelierT.salesNGN, "db: RTW + Atelier sales equals combined");

  await prisma.order.update({
    where: { id: rtw.id },
    data: { total: 9_999_999 },
  });
  const second = await buildFinanceReport(range.from, range.to);
  const firstOurs = first.lines
    .filter((l) => l.reference.endsWith(stamp))
    .map((l) => ({ id: l.id, sales: l.salesNGN, cash: l.cashNGN, points: l.pointsNGN, ship: l.shippingCollectedNGN, liab: l.liabilityNGN }));
  const secondOurs = second.lines
    .filter((l) => l.reference.endsWith(stamp))
    .map((l) => ({ id: l.id, sales: l.salesNGN, cash: l.cashNGN, points: l.pointsNGN, ship: l.shippingCollectedNGN, liab: l.liabilityNGN }));
  assert(JSON.stringify(firstOurs) === JSON.stringify(secondOurs), "re-run of September is unchanged after Order.total mutates");

  await prisma.order.update({
    where: { id: cancelled.id },
    data: { refundRecordedAt: new Date("2026-09-20T12:00:00+01:00") },
  });
  const afterRefund = await buildFinanceReport(range.from, range.to);
  const cxlAfter = afterRefund.lines.find((l) => l.reference === `AA-CXL-${stamp}`);
  assert(cxlAfter?.liabilityNGN === 0, "db: liability clears once refundRecordedAt is set");
  assert(cxlAfter?.salesNGN === 0, "db: recorded refund does not become a sale");
}

async function main() {
  runPure();
  try {
    await runDb();
  } finally {
    await prisma.$disconnect();
  }
  console.log("test-slice-aa: ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
