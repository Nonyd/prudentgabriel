import { NextRequest, NextResponse } from "next/server";
import { InvoiceStatus, Prisma } from "@prisma/client";
import { nanoid } from "nanoid";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-auth";
import {
  calculateInvoiceTotals,
  generateInvoiceNumber,
  getInvoiceDefaultPaymentTerms,
  syncLineItemAmounts,
} from "@/lib/invoice";
import { getSetting } from "@/lib/settings";
import { mapBespokeOrdersByRequestId, mapBespokeOrdersByClientEmail } from "@/lib/invoice-bespoke-order";
import type { InvoiceLineItem } from "@/types/invoice";

const lineItemInput = z.object({
  id: z.string().optional(),
  description: z.string().min(1),
  details: z.string().optional().nullable(),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
});

const postSchema = z.object({
  bespokeRequestId: z.string().optional().nullable(),
  consultationId: z.string().optional().nullable(),
  clientName: z.string().optional().nullable(),
  clientEmail: z.string().email().optional().nullable(),
  clientPhone: z.string().optional().nullable(),
  clientAddress: z.string().optional().nullable(),
  clientCity: z.string().optional().nullable(),
  clientCountry: z.string().optional().nullable(),
  clientInstagram: z.string().optional().nullable(),
  currency: z.enum(["NGN", "USD", "GBP"]).optional(),
  exchangeRate: z.number().positive().optional(),
  lineItems: z.array(lineItemInput).optional(),
  discountType: z.enum(["PERCENTAGE", "FIXED"]).optional().nullable(),
  discountValue: z.number().nonnegative().optional(),
  vatEnabled: z.boolean().optional(),
  vatPercent: z.number().nonnegative().optional(),
  paymentTerms: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  clientNote: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  showVat: z.boolean().optional(),
  showRcNumber: z.boolean().optional(),
  depositPercent: z.number().min(0).max(100).optional(),
});

export async function GET(req: NextRequest) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const search = searchParams.get("search")?.trim();
  const currency = searchParams.get("currency");
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get("limit") ?? "20", 10) || 20));
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: Prisma.InvoiceWhereInput = {};
  if (status && status !== "all" && (Object.values(InvoiceStatus) as string[]).includes(status)) {
    where.status = status as InvoiceStatus;
  }
  if (currency && currency !== "all" && ["NGN", "USD", "GBP"].includes(currency)) {
    where.currency = currency;
  }
  if (search) {
    where.OR = [
      { clientName: { contains: search, mode: "insensitive" } },
      { clientEmail: { contains: search, mode: "insensitive" } },
      { invoiceNumber: { contains: search, mode: "insensitive" } },
    ];
  }
  if (from || to) {
    where.createdAt = {};
    if (from) {
      const d = new Date(from);
      if (!Number.isNaN(d.getTime())) where.createdAt.gte = d;
    }
    if (to) {
      const d = new Date(to);
      if (!Number.isNaN(d.getTime())) where.createdAt.lte = d;
    }
  }

  const [total, invoices] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        bespokeRequest: { select: { id: true, requestNumber: true, occasion: true } },
      },
    }),
  ]);

  const orderByRequestId = await mapBespokeOrdersByRequestId(
    invoices.map((invoice) => invoice.bespokeRequestId).filter((id): id is string => Boolean(id)),
  );
  const orderByEmail = await mapBespokeOrdersByClientEmail(invoices.map((invoice) => invoice.clientEmail));
  const invoicesWithOrders = invoices.map((invoice) => ({
    ...invoice,
    bespokeOrder:
      (invoice.bespokeRequestId ? orderByRequestId.get(invoice.bespokeRequestId) : null) ??
      orderByEmail.get(invoice.clientEmail.trim().toLowerCase()) ??
      null,
  }));

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const statsParam = searchParams.get("stats");
  if (statsParam === "1") {
    const [totalInvoiced, outstanding, overdue, paidThisMonth] = await Promise.all([
      prisma.invoice.aggregate({ _sum: { total: true } }),
      prisma.invoice.count({
        where: {
          status: { in: [InvoiceStatus.SENT, InvoiceStatus.VIEWED, InvoiceStatus.PARTIALLY_PAID] },
          balanceDue: { gt: 0 },
        },
      }),
      prisma.invoice.count({ where: { status: InvoiceStatus.OVERDUE } }),
      prisma.invoice.count({
        where: {
          status: InvoiceStatus.PAID,
          paidAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
    ]);
    return NextResponse.json({
      invoices: invoicesWithOrders,
      total,
      page,
      totalPages,
      stats: {
        totalInvoiced: totalInvoiced._sum.total ?? 0,
        outstanding,
        overdue,
        paidThisMonth,
      },
    });
  }

  return NextResponse.json({ invoices: invoicesWithOrders, total, page, totalPages });
}

export async function POST(req: NextRequest) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;
  let bespoke: {
    id: string;
    name: string;
    email: string;
    phone: string;
    country: string | null;
    occasion: string;
    description: string;
    agreedPrice: number | null;
    estimatedPrice: number | null;
  } | null = null;

  let consultation: {
    id: string;
    clientName: string;
    clientEmail: string;
    clientPhone: string;
    clientCountry: string;
    occasion: string;
    feeNGN: number;
  } | null = null;

  if (d.consultationId) {
    const c = await prisma.consultationBooking.findUnique({
      where: { id: d.consultationId },
      select: {
        id: true,
        clientName: true,
        clientEmail: true,
        clientPhone: true,
        clientCountry: true,
        occasion: true,
        feeNGN: true,
      },
    });
    if (!c) return NextResponse.json({ error: "Consultation not found" }, { status: 404 });
    consultation = c;
  }

  if (d.bespokeRequestId) {
    const b = await prisma.bespokeRequest.findUnique({
      where: { id: d.bespokeRequestId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        country: true,
        occasion: true,
        description: true,
        agreedPrice: true,
        estimatedPrice: true,
      },
    });
    if (!b) return NextResponse.json({ error: "Bespoke request not found" }, { status: 404 });
    bespoke = b;
  }

  const defaultCurrency = ((await getSetting("invoice_default_currency")) ?? "NGN").toUpperCase();
  const cur =
    d.currency ??
    (defaultCurrency === "USD" || defaultCurrency === "GBP" ? defaultCurrency : "NGN");

  const clientName = d.clientName ?? bespoke?.name ?? consultation?.clientName;
  const clientEmail = d.clientEmail ?? bespoke?.email ?? consultation?.clientEmail;
  if (!clientName || !clientEmail) {
    return NextResponse.json({ error: "clientName and clientEmail are required" }, { status: 400 });
  }

  let lineItemsIn = d.lineItems ?? [];
  if (lineItemsIn.length === 0 && consultation) {
    lineItemsIn = [
      {
        description: `Consultation fee — ${consultation.occasion}`,
        details: "Atelier consultation session",
        quantity: 1,
        unitPrice: consultation.feeNGN,
      },
      {
        description: `Atelier commission — ${consultation.occasion}`,
        details: "Made-to-measure couture commission",
        quantity: 1,
        unitPrice: 0,
      },
    ];
  }
  if (lineItemsIn.length === 0 && bespoke) {
    const unit = bespoke.agreedPrice ?? bespoke.estimatedPrice ?? 0;
    const desc = `${bespoke.occasion} — Atelier commission`;
    const det = bespoke.description.slice(0, 100);
    lineItemsIn = [{ description: desc, details: det, quantity: 1, unitPrice: unit }];
  }
  if (lineItemsIn.length === 0) {
    return NextResponse.json({ error: "At least one line item is required" }, { status: 400 });
  }

  const items: InvoiceLineItem[] = syncLineItemAmounts(
    lineItemsIn.map((li) => ({
      id: li.id ?? nanoid(),
      description: li.description,
      details: li.details ?? undefined,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      amount: li.quantity * li.unitPrice,
    })),
  );

  const { getBespokeDepositPercent } = await import("@/lib/payments/ledger");
  const defaultBespokeDeposit = bespoke ? await getBespokeDepositPercent() : 0;
  const depositPct = d.depositPercent ?? defaultBespokeDeposit;
  const discountType = d.discountType ?? null;
  const discountValue = d.discountValue ?? 0;
  const vatEnabled = d.vatEnabled ?? false;
  const vatPercent = d.vatPercent ?? 0;

  const totals = calculateInvoiceTotals({
    lineItems: items,
    discountType: discountType ?? undefined,
    discountValue,
    vatEnabled,
    vatPercent,
    depositPercent: depositPct,
    depositPaid: 0,
  });

  const defaultTerms = await getInvoiceDefaultPaymentTerms();
  const paymentTerms = (d.paymentTerms ?? defaultTerms) || null;
  let dueDate: Date | null = null;
  if (d.dueDate) {
    const dt = new Date(d.dueDate);
    if (!Number.isNaN(dt.getTime())) dueDate = dt;
  }

  const created = await prisma.$transaction(async (tx) => {
    const number = await generateInvoiceNumber(tx);
    return tx.invoice.create({
      data: {
        invoiceNumber: number,
        bespokeRequestId: bespoke?.id ?? d.bespokeRequestId ?? null,
        consultationId: consultation?.id ?? d.consultationId ?? null,
        clientName,
        clientEmail,
        clientPhone: d.clientPhone ?? bespoke?.phone ?? consultation?.clientPhone ?? null,
        clientAddress: d.clientAddress ?? null,
        clientCity: d.clientCity ?? null,
        clientCountry: d.clientCountry ?? bespoke?.country ?? consultation?.clientCountry ?? "Nigeria",
        clientInstagram: d.clientInstagram ?? null,
        currency: cur,
        exchangeRate: d.exchangeRate ?? 1,
        status: InvoiceStatus.DRAFT,
        lineItems: items as unknown as Prisma.InputJsonValue,
        subtotal: totals.subtotal,
        discountType,
        discountValue,
        discountAmount: totals.discountAmount,
        vatEnabled,
        vatPercent,
        vatAmount: totals.vatAmount,
        total: totals.total,
        depositRequired: totals.depositRequired,
        depositPaid: 0,
        balanceDue: totals.balanceDue,
        paymentTerms,
        dueDate,
        clientNote: d.clientNote ?? null,
        notes: d.notes ?? null,
        showVat: d.showVat ?? false,
        showRcNumber: d.showRcNumber ?? false,
        paymentHistory: [],
        createdBy: gate.session.user?.id ?? null,
      },
      include: {
        bespokeRequest: { select: { id: true, requestNumber: true, occasion: true } },
      },
    });
  });

  return NextResponse.json(created);
}
