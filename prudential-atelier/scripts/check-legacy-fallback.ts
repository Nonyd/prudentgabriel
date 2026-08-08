import { PrismaClient } from "@prisma/client";
import {
  getOrderPaymentSummary,
  getInvoicePaymentSummary,
  getLegacyFallbackHitCount,
} from "../src/lib/payments/ledger";

const prisma = new PrismaClient();

async function main() {
  const orders = await prisma.bespokeOrder.findMany({
    select: { id: true, orderRef: true, amountPaid: true },
  });
  const invoices = await prisma.invoice.findMany({
    select: { id: true, invoiceNumber: true, depositPaid: true },
  });

  let legacy = 0;
  const details: string[] = [];

  for (const o of orders) {
    const s = await getOrderPaymentSummary(o.id);
    if (s.usedLegacyFallback) {
      legacy += 1;
      details.push(`order ${o.orderRef} amountPaid=${o.amountPaid}`);
    }
  }
  for (const inv of invoices) {
    const s = await getInvoicePaymentSummary(inv.id);
    if (s.usedLegacyFallback) {
      legacy += 1;
      details.push(`invoice ${inv.invoiceNumber} depositPaid=${inv.depositPaid}`);
    }
  }

  const payCount = await prisma.payment.count();
  console.log(`usedLegacyFallback count: ${legacy}`);
  console.log(`getLegacyFallbackHitCount(): ${getLegacyFallbackHitCount()}`);
  console.log(`Payment row count: ${payCount}`);
  if (details.length) {
    console.log("Entities still on legacy:");
    for (const d of details) console.log(`  - ${d}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
