import { NextRequest, NextResponse } from "next/server";
import { InvoiceStatus, PaymentGateway, PaymentMethod, PaymentPurpose, PaymentStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  sendBankTransferAdminNotification,
  sendBankTransferReceiptReceivedEmail,
} from "@/lib/email";
import { notifyBankTransferReceipt } from "@/lib/notifications";
import { getPublicAppUrl } from "@/lib/app-url";
import { receiptMediaUrlSchema } from "@/lib/media/stored-url";
import { encodeBespokePaymentRef, parseBespokePaymentRef } from "@/lib/bespoke-order-access";
import { generatePaymentReference } from "@/lib/payments/index";
import { bankTransferAvailable } from "@/lib/payments/bank-account";
import {
  appendPayment,
  getOrderPaymentSummary,
  inferBespokePurpose,
  resolveClientId,
  toNumber,
} from "@/lib/payments/ledger";
import { remainingDepositNGN } from "@/lib/atelier-fx";

const bodySchema = z.object({
  amount: z.union([z.literal("deposit"), z.literal("full"), z.number().positive()]),
  receiptUrl: receiptMediaUrlSchema,
  currency: z.enum(["NGN", "USD", "GBP"]).optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
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

  const inv = await prisma.invoice.findUnique({ where: { publicToken: token } });
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (inv.status === InvoiceStatus.DRAFT || inv.status === InvoiceStatus.PAID || inv.status === InvoiceStatus.CANCELLED) {
    return NextResponse.json({ error: "This invoice cannot collect payment" }, { status: 400 });
  }
  if (!inv.quotationId) {
    return NextResponse.json({ error: "This invoice is not linked to a commission" }, { status: 400 });
  }

  const order = await prisma.bespokeOrder.findFirst({ where: { quotationId: inv.quotationId } });
  if (!order || order.balance <= 0) {
    return NextResponse.json({ error: "Nothing to pay" }, { status: 400 });
  }

  const payCurrency = parsed.data.currency ?? "NGN";
  if (!(await bankTransferAvailable(payCurrency, "ATELIER"))) {
    return NextResponse.json({ error: "Bank transfer is not available for this currency" }, { status: 400 });
  }

  const summary = await getOrderPaymentSummary(order.id);
  const remainingDeposit = remainingDepositNGN({
    depositRequiredNGN: toNumber(summary.depositRequired),
    confirmedNGN: toNumber(summary.confirmed),
  });
  const remainingBalance = toNumber(summary.balance);
  let payAmountNGN =
    parsed.data.amount === "deposit"
      ? remainingDeposit || remainingBalance
      : parsed.data.amount === "full"
        ? remainingBalance
        : parsed.data.amount;
  payAmountNGN = Math.min(Math.round(payAmountNGN), Math.round(remainingBalance));
  if (payAmountNGN <= 0) {
    return NextResponse.json({ error: "Nothing to pay" }, { status: 400 });
  }

  const { reference: existingRef } = parseBespokePaymentRef(order.paymentRef);
  const reference = existingRef || generatePaymentReference("BESPOKE");

  await prisma.payment.updateMany({
    where: { bespokeOrderId: order.id, status: PaymentStatus.PENDING },
    data: { status: PaymentStatus.REJECTED, rejectedReason: "Superseded by new transfer receipt" },
  });

  const purpose =
    inferBespokePurpose({
      amount: payAmountNGN,
      balanceBefore: remainingBalance,
      depositRequired: toNumber(summary.depositRequired),
      confirmedBefore: toNumber(summary.confirmed),
    }) ?? PaymentPurpose.DEPOSIT;

  const clientId = await resolveClientId({ email: order.clientEmail });
  const ledgerRef = `${reference}-${Date.now()}`;

  await appendPayment({
    reference: ledgerRef,
    amount: payAmountNGN,
    method: PaymentMethod.BANK_TRANSFER,
    status: PaymentStatus.PENDING,
    purpose,
    receiptUrl: parsed.data.receiptUrl,
    bespokeOrderId: order.id,
    invoiceId: inv.id,
    clientId,
  });

  await prisma.bespokeOrder.update({
    where: { id: order.id },
    data: {
      paymentGateway: PaymentGateway.BANK_TRANSFER,
      paymentRef: encodeBespokePaymentRef(reference, payAmountNGN),
      paymentReceiptUrl: parsed.data.receiptUrl,
    },
  });

  void sendBankTransferReceiptReceivedEmail({
    to: order.clientEmail,
    clientName: order.clientName,
    ref: order.orderRef,
    amountNGN: payAmountNGN,
  });
  void sendBankTransferAdminNotification({
    ref: order.orderRef,
    clientName: order.clientName,
    amountNGN: payAmountNGN,
    receiptUrl: parsed.data.receiptUrl,
    adminPath: `/admin/bespoke/${order.id}`,
  });
  notifyBankTransferReceipt({
    ref: order.orderRef,
    clientName: order.clientName,
    amountNGN: payAmountNGN,
    link: `/admin/bespoke/${order.id}`,
    entityId: order.id,
  });

  const appUrl = getPublicAppUrl();
  return NextResponse.json({
    success: true,
    redirectUrl: `${appUrl}/payment/pending?reference=${encodeURIComponent(order.orderRef)}&type=bespoke&orderId=${encodeURIComponent(order.id)}`,
  });
}
