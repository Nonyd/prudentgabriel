import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PaymentGateway } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  sendBankTransferAdminNotification,
  sendBankTransferReceiptReceivedEmail,
} from "@/lib/email";
import { getPublicAppUrl } from "@/lib/app-url";
import {
  encodeBespokePaymentRef,
  getBespokeOrderForUser,
  parseBespokePaymentRef,
} from "@/lib/bespoke-order-access";
import { generatePaymentReference } from "@/lib/payments/index";

const bodySchema = z.object({
  amount: z.number().positive(),
  receiptUrl: z.string().url(),
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

  const payAmountNGN = Math.min(Math.round(parsed.data.amount), Math.round(order.balance));
  const { reference: existingRef } = parseBespokePaymentRef(order.paymentRef);
  const reference = existingRef || generatePaymentReference("BESPOKE");

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

  const appUrl = getPublicAppUrl();
  return NextResponse.json({
    success: true,
    redirectUrl: `${appUrl}/payment/pending?reference=${encodeURIComponent(order.orderRef)}&type=bespoke&orderId=${encodeURIComponent(order.id)}`,
  });
}
