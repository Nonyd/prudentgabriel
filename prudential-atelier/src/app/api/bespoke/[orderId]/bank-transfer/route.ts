import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PaymentGateway, PaymentStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  sendBankTransferAdminNotification,
  sendBankTransferReceiptReceivedEmail,
} from "@/lib/email";
import { notifyBankTransferReceipt } from "@/lib/notifications";
import { getPublicAppUrl } from "@/lib/app-url";
import { receiptMediaUrlSchema } from "@/lib/media/stored-url";
import {
  encodeBespokePaymentRef,
  getBespokeOrderForUser,
  parseBespokePaymentRef,
} from "@/lib/bespoke-order-access";
import { generatePaymentReference } from "@/lib/payments/index";
import { bankTransferAvailable } from "@/lib/payments/bank-account";
import {
  appendPayment,
  getOrderPaymentSummary,
  inferBespokePurpose,
  resolveClientId,
  toNumber,
} from "@/lib/payments/ledger";
import { PaymentMethod, PaymentPurpose } from "@prisma/client";

const bodySchema = z.object({
  amount: z.number().positive(),
  receiptUrl: receiptMediaUrlSchema,
  currency: z.enum(["NGN", "USD", "GBP"]).optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ orderId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderId } = await ctx.params;
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

  const order = await getBespokeOrderForUser(orderId, session.user.id);
  if (!order || order.balance <= 0) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const payCurrency = parsed.data.currency ?? "NGN";
  if (!(await bankTransferAvailable(payCurrency, "ATELIER"))) {
    return NextResponse.json({ error: "Bank transfer is not available for this currency" }, { status: 400 });
  }

  const summary = await getOrderPaymentSummary(order.id);
  const payAmountNGN = Math.min(Math.round(parsed.data.amount), Math.round(toNumber(summary.balance)));
  if (payAmountNGN <= 0) {
    return NextResponse.json({ error: "Nothing to pay" }, { status: 400 });
  }

  const { reference: existingRef } = parseBespokePaymentRef(order.paymentRef);
  const reference = existingRef || generatePaymentReference("BESPOKE");

  // Cancel any prior pending ledger row for this order (receipt resubmit).
  await prisma.payment.updateMany({
    where: { bespokeOrderId: order.id, status: PaymentStatus.PENDING },
    data: { status: PaymentStatus.REJECTED, rejectedReason: "Superseded by new transfer receipt" },
  });

  const purpose =
    inferBespokePurpose({
      amount: payAmountNGN,
      balanceBefore: toNumber(summary.balance),
      depositRequired: toNumber(summary.depositRequired),
      confirmedBefore: toNumber(summary.confirmed),
    }) ?? PaymentPurpose.DEPOSIT;

  const clientId = await resolveClientId({
    userId: session.user.id,
    email: order.clientEmail,
  });

  // Unique reference per pending attempt
  const ledgerRef = `${reference}-${Date.now()}`;

  await appendPayment({
    reference: ledgerRef,
    amount: payAmountNGN,
    method: PaymentMethod.BANK_TRANSFER,
    status: PaymentStatus.PENDING,
    purpose,
    receiptUrl: parsed.data.receiptUrl,
    bespokeOrderId: order.id,
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
