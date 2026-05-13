import { NextRequest, NextResponse } from "next/server";
import { InvoiceStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-auth";
import { parseInvoicePaymentHistory } from "@/lib/invoice";

const bodySchema = z.object({
  amount: z.number().positive(),
  method: z.string().min(1),
  reference: z.string().optional(),
  fullPayment: z.boolean(),
  paymentDate: z.string().optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi();
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

  const history = parseInvoicePaymentHistory(inv.paymentHistory);
  history.push({
    recordedAt: paidAt.toISOString(),
    amount,
    method,
    reference,
  });

  if (fullPayment) {
    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        status: InvoiceStatus.PAID,
        paidAt,
        depositPaid: inv.total,
        balanceDue: 0,
        paymentMethod: method,
        paymentRef: reference ?? inv.paymentRef,
        paymentHistory: history as unknown as Prisma.InputJsonValue,
      },
      include: {
        bespokeRequest: { select: { id: true, requestNumber: true, occasion: true, status: true } },
      },
    });
    return NextResponse.json(updated);
  }

  const newDepositPaid = inv.depositPaid + amount;
  const balanceDue = Math.round(Math.max(0, inv.total - newDepositPaid) * 100) / 100;

  let status: InvoiceStatus = InvoiceStatus.PARTIALLY_PAID;
  if (balanceDue <= 0) {
    status = InvoiceStatus.PAID;
  } else if (inv.status === InvoiceStatus.DRAFT) {
    status = InvoiceStatus.PARTIALLY_PAID;
  } else if (inv.status === InvoiceStatus.SENT || inv.status === InvoiceStatus.VIEWED) {
    status = InvoiceStatus.PARTIALLY_PAID;
  } else {
    status = inv.status;
  }

  const updated = await prisma.invoice.update({
    where: { id },
    data: {
      depositPaid: newDepositPaid,
      balanceDue,
      paymentMethod: method,
      paymentRef: reference ?? inv.paymentRef,
      status,
      paidAt: status === InvoiceStatus.PAID ? paidAt : inv.paidAt,
      paymentHistory: history as unknown as Prisma.InputJsonValue,
    },
    include: {
      bespokeRequest: { select: { id: true, requestNumber: true, occasion: true, status: true } },
    },
  });

  return NextResponse.json(updated);
}
