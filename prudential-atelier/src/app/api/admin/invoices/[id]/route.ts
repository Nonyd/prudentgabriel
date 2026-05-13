import { NextRequest, NextResponse } from "next/server";
import { InvoiceStatus, Prisma } from "@prisma/client";
import { nanoid } from "nanoid";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-auth";
import { calculateInvoiceTotals, parseInvoiceLineItems, syncLineItemAmounts } from "@/lib/invoice";
import type { InvoiceLineItem } from "@/types/invoice";

const lineItemInput = z.object({
  id: z.string().optional(),
  description: z.string().min(1),
  details: z.string().optional().nullable(),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
});

const patchSchema = z.object({
  bespokeRequestId: z.string().optional().nullable(),
  clientName: z.string().min(1).optional(),
  clientEmail: z.string().email().optional(),
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
  status: z.nativeEnum(InvoiceStatus).optional(),
  depositPercent: z.number().min(0).max(100).optional(),
});

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  const inv = await prisma.invoice.findUnique({
    where: { id },
    include: {
      bespokeRequest: { select: { id: true, requestNumber: true, occasion: true, status: true } },
    },
  });
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (
    inv.dueDate &&
    inv.balanceDue > 0 &&
    new Date(inv.dueDate) < new Date() &&
    (inv.status === "SENT" || inv.status === "VIEWED" || inv.status === "PARTIALLY_PAID")
  ) {
    const upd = await prisma.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.OVERDUE },
      include: {
        bespokeRequest: { select: { id: true, requestNumber: true, occasion: true, status: true } },
      },
    });
    return NextResponse.json(upd);
  }

  return NextResponse.json(inv);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  const prev = await prisma.invoice.findUnique({ where: { id } });
  if (!prev) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const p = parsed.data;
  const data: Prisma.InvoiceUpdateInput = {};

  if (p.bespokeRequestId !== undefined) {
    data.bespokeRequest = p.bespokeRequestId ? { connect: { id: p.bespokeRequestId } } : { disconnect: true };
  }
  if (p.clientName !== undefined) data.clientName = p.clientName;
  if (p.clientEmail !== undefined) data.clientEmail = p.clientEmail;
  if (p.clientPhone !== undefined) data.clientPhone = p.clientPhone;
  if (p.clientAddress !== undefined) data.clientAddress = p.clientAddress;
  if (p.clientCity !== undefined) data.clientCity = p.clientCity;
  if (p.clientCountry !== undefined) data.clientCountry = p.clientCountry ?? "Nigeria";
  if (p.clientInstagram !== undefined) data.clientInstagram = p.clientInstagram;
  if (p.currency !== undefined) data.currency = p.currency;
  if (p.exchangeRate !== undefined) data.exchangeRate = p.exchangeRate;
  if (p.paymentTerms !== undefined) data.paymentTerms = p.paymentTerms;
  if (p.clientNote !== undefined) data.clientNote = p.clientNote;
  if (p.notes !== undefined) data.notes = p.notes;
  if (p.showVat !== undefined) data.showVat = p.showVat;
  if (p.showRcNumber !== undefined) data.showRcNumber = p.showRcNumber;
  if (p.status !== undefined) data.status = p.status;

  if (p.dueDate !== undefined) {
    if (p.dueDate === null) data.dueDate = null;
    else {
      const dt = new Date(p.dueDate);
      if (!Number.isNaN(dt.getTime())) data.dueDate = dt;
    }
  }

  if (p.discountType !== undefined) data.discountType = p.discountType;
  if (p.discountValue !== undefined) data.discountValue = p.discountValue;
  if (p.vatEnabled !== undefined) data.vatEnabled = p.vatEnabled;
  if (p.vatPercent !== undefined) data.vatPercent = p.vatPercent;

  const mergedDiscountType = p.discountType !== undefined ? p.discountType : prev.discountType;
  const mergedDiscountValue = p.discountValue !== undefined ? p.discountValue : prev.discountValue;
  const mergedVatEnabled = p.vatEnabled !== undefined ? p.vatEnabled : prev.vatEnabled;
  const mergedVatPercent = p.vatPercent !== undefined ? p.vatPercent : prev.vatPercent;

  let synced: InvoiceLineItem[] = parseInvoiceLineItems(prev.lineItems);
  if (p.lineItems) {
    synced = syncLineItemAmounts(
      p.lineItems.map((li) => ({
        id: li.id ?? nanoid(),
        description: li.description,
        details: li.details ?? undefined,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        amount: li.quantity * li.unitPrice,
      })),
    );
    data.lineItems = synced as unknown as Prisma.InputJsonValue;
  }

  const needsRecalc =
    Boolean(p.lineItems) ||
    p.discountType !== undefined ||
    p.discountValue !== undefined ||
    p.vatEnabled !== undefined ||
    p.vatPercent !== undefined ||
    p.depositPercent !== undefined;

  if (needsRecalc) {
    const items = p.lineItems ? synced : parseInvoiceLineItems(prev.lineItems);
    const finalItems = syncLineItemAmounts(items);
    let depositPct =
      prev.total > 0 && prev.depositRequired > 0 ? (prev.depositRequired / prev.total) * 100 : 0;
    if (p.depositPercent !== undefined) depositPct = p.depositPercent;
    const totals = calculateInvoiceTotals({
      lineItems: finalItems,
      discountType: (mergedDiscountType as "PERCENTAGE" | "FIXED" | undefined) ?? undefined,
      discountValue: mergedDiscountValue,
      vatEnabled: mergedVatEnabled,
      vatPercent: mergedVatPercent,
      depositPercent: depositPct,
      depositPaid: prev.depositPaid,
    });
    data.lineItems = finalItems as unknown as Prisma.InputJsonValue;
    data.subtotal = totals.subtotal;
    data.discountAmount = totals.discountAmount;
    data.vatAmount = totals.vatAmount;
    data.total = totals.total;
    data.depositRequired = totals.depositRequired;
    data.balanceDue = totals.balanceDue;
  }

  const updated = await prisma.invoice.update({
    where: { id },
    data,
    include: {
      bespokeRequest: { select: { id: true, requestNumber: true, occasion: true, status: true } },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  const prev = await prisma.invoice.findUnique({ where: { id } });
  if (!prev) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (prev.status !== InvoiceStatus.DRAFT) {
    return NextResponse.json({ error: "Only draft invoices can be deleted" }, { status: 400 });
  }

  await prisma.invoice.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
