import { NextRequest, NextResponse } from "next/server";
import { PaymentMethod, PaymentPurpose, PaymentStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-auth";
import { parseInvoicePaymentHistory } from "@/lib/invoice";
import {
  appendPayment,
  getInvoicePaymentSummary,
  resolveClientId,
  toNumber,
} from "@/lib/payments/ledger";
import { generatePaymentReference } from "@/lib/payments/index";

const bodySchema = z.object({
  amount: z.number().positive(),
  method: z.string().min(1),
  reference: z.string().optional(),
  fullPayment: z.boolean(),
  paymentDate: z.string().optional(),
});

function mapMethod(method: string): PaymentMethod {
  const m = method.toUpperCase().replace(/\s+/g, "_");
  if (m.includes("PAYSTACK")) return PaymentMethod.PAYSTACK;
  if (m.includes("FLUTTER")) return PaymentMethod.FLUTTERWAVE;
  if (m.includes("STRIPE")) return PaymentMethod.STRIPE;
  if (m.includes("MONNIFY")) return PaymentMethod.MONNIFY;
  if (m.includes("BANK") || m.includes("TRANSFER")) return PaymentMethod.BANK_TRANSFER;
  return PaymentMethod.MANUAL;
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi("invoices");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  const inv = await prisma.invoice.findUnique({ where: { id } });
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { amount, method, reference, fullPayment, paymentDate } = parsed.data;
  const paidAt = paymentDate ? new Date(paymentDate) : new Date();
  if (Number.isNaN(paidAt.getTime())) {
    return NextResponse.json({ error: "Invalid paymentDate" }, { status: 400 });
  }

  const summary = await getInvoicePaymentSummary(id);
  const payAmount = fullPayment ? toNumber(summary.balance) : amount;
  if (payAmount <= 0) {
    return NextResponse.json({ error: "Nothing to pay" }, { status: 400 });
  }

  const purpose =
    fullPayment || payAmount >= toNumber(summary.balance) - 0.01
      ? PaymentPurpose.FULL
      : toNumber(summary.confirmed) < toNumber(summary.depositRequired)
        ? PaymentPurpose.DEPOSIT
        : PaymentPurpose.BALANCE;

  const clientId = await resolveClientId({ email: inv.clientEmail });
  const ref = reference?.trim() || generatePaymentReference("INV");

  let bespokeOrderId: string | null = null;
  if (inv.quotationId) {
    const order = await prisma.bespokeOrder.findFirst({
      where: { quotationId: inv.quotationId },
      select: { id: true },
    });
    bespokeOrderId = order?.id ?? null;
  }

  // Keep legacy JSON history in sync for older UI surfaces.
  const history = parseInvoicePaymentHistory(inv.paymentHistory);
  history.push({
    recordedAt: paidAt.toISOString(),
    amount: payAmount,
    method,
    reference: ref,
  });

  await appendPayment({
    reference: ref,
    amount: payAmount,
    currency: inv.currency,
    method: mapMethod(method),
    status: PaymentStatus.CONFIRMED,
    purpose,
    invoiceId: inv.id,
    bespokeOrderId,
    clientId,
    confirmedById: gate.session.user?.id ?? null,
    confirmedAt: paidAt,
    createdAt: paidAt,
  });

  await prisma.invoice.update({
    where: { id },
    data: {
      paymentMethod: method,
      paymentRef: ref,
      paymentHistory: history as unknown as Prisma.InputJsonValue,
    },
  });

  const updated = await prisma.invoice.findUnique({
    where: { id },
    include: {
      bespokeRequest: { select: { id: true, requestNumber: true, occasion: true, status: true } },
    },
  });

  return NextResponse.json(updated);
}
