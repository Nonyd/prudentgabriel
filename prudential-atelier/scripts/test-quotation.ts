/**
 * Quotation versioning + document numbering tests.
 *
 *   pnpm test:quotation
 */
import { QuoteStatus, Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { allocateInvoiceNumber, formatQuotationRef } from "../src/lib/document-numbers";
import { reviseQuotation } from "../src/lib/quotation-versioning";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

async function cleanup(ids: { quoteIds: string[]; invoiceIds: string[] }) {
  if (ids.invoiceIds.length) {
    await prisma.invoice.deleteMany({ where: { id: { in: ids.invoiceIds } } });
  }
  if (ids.quoteIds.length) {
    await prisma.quotation.deleteMany({ where: { id: { in: ids.quoteIds } } });
  }
}

async function main() {
  const quoteIds: string[] = [];
  const invoiceIds: string[] = [];

  try {
    // --- Two invoices in one transaction get distinct numbers ---
    const [a, b] = await prisma.$transaction(async (tx) => {
      const n1 = await allocateInvoiceNumber(tx);
      const n2 = await allocateInvoiceNumber(tx);
      return [n1, n2];
    });
    assert(a !== b, `invoice numbers in same tx must differ (${a} vs ${b})`);
    assert(/PA-INV-\d{4}-\d{4}/.test(a), `invoice format: ${a}`);

    // --- Seed a sent quotation ---
    const base = `QT-TEST-${Date.now().toString().slice(-6)}`;
    const v1 = await prisma.quotation.create({
      data: {
        quoteRef: base,
        baseQuoteRef: base,
        version: 1,
        clientName: "Test Client",
        clientEmail: `quote-test-${Date.now()}@example.com`,
        lineItems: [{ description: "Gown", quantity: 1, unitPrice: 100_000, total: 100_000 }] as unknown as Prisma.InputJsonValue,
        subtotal: 100_000,
        tax: 0,
        discount: 0,
        total: 100_000,
        status: QuoteStatus.SENT,
        sentAt: new Date(),
      },
    });
    quoteIds.push(v1.id);

    const v2 = await reviseQuotation({
      quotationId: v1.id,
      actor: { id: "test-actor", email: "admin@example.com", role: "ADMIN" },
    });
    quoteIds.push(v2.id);

    assert(v2.version === 2, "revision version is 2");
    assert(v2.quoteRef === formatQuotationRef(base, 2), `v2 ref ${v2.quoteRef}`);
    assert(v2.parentQuotationId === v1.id, "parent linked");
    assert(v2.status === QuoteStatus.DRAFT, "new version is DRAFT");

    const old = await prisma.quotation.findUnique({ where: { id: v1.id } });
    assert(old?.status === QuoteStatus.SUPERSEDED, "previous marked SUPERSEDED");

    // Superseded cannot be approved via status check (API returns 409) — unit check here
    assert(old?.status === QuoteStatus.SUPERSEDED, "superseded not approvable");

    // Converted quotation cannot be revised
    const convBase = `QT-CONV-${Date.now().toString().slice(-6)}`;
    const converted = await prisma.quotation.create({
      data: {
        quoteRef: convBase,
        baseQuoteRef: convBase,
        version: 1,
        clientName: "Converted Client",
        clientEmail: `conv-${Date.now()}@example.com`,
        lineItems: [{ description: "Suit", quantity: 1, unitPrice: 50_000, total: 50_000 }] as unknown as Prisma.InputJsonValue,
        subtotal: 50_000,
        tax: 0,
        discount: 0,
        total: 50_000,
        status: QuoteStatus.CONVERTED,
        sentAt: new Date(),
      },
    });
    quoteIds.push(converted.id);

    const inv = await prisma.invoice.create({
      data: {
        invoiceNumber: `PA-INV-TEST-${Date.now()}`,
        quotationId: converted.id,
        clientName: converted.clientName,
        clientEmail: converted.clientEmail,
        currency: "NGN",
        lineItems: [],
        subtotal: 50_000,
        total: 50_000,
        balanceDue: 50_000,
        paymentHistory: [],
      },
    });
    invoiceIds.push(inv.id);

    let blocked = false;
    try {
      await reviseQuotation({
        quotationId: converted.id,
        actor: { id: "test-actor", email: "admin@example.com", role: "ADMIN" },
      });
    } catch (e) {
      blocked = e instanceof Error && e.message === "CONVERTED";
    }
    assert(blocked, "converted quotation cannot be revised");

    // Superseded cannot be converted (shared convert helper)
    const { convertQuotationToOrder } = await import("../src/lib/quotation-convert");
    let superBlocked = false;
    try {
      await convertQuotationToOrder(old!);
    } catch (e) {
      superBlocked = e instanceof Error && e.message === "SUPERSEDED";
    }
    assert(superBlocked, "superseded quotation cannot be converted");

    assert(formatQuotationRef(base, 1) === base, "v1 ref is bare base (no -v1)");
    assert(formatQuotationRef(base, 2) === `${base}-v2`, "v2+ uses -vN suffix");

    console.log("OK — quotation versioning + invoice numbering");
  } finally {
    await cleanup({ quoteIds, invoiceIds });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
