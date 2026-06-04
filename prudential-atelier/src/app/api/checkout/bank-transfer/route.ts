import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PaymentGateway, PaymentStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  sendBankTransferAdminNotification,
  sendBankTransferReceiptReceivedEmail,
} from "@/lib/email";
import { getPublicAppUrl } from "@/lib/app-url";

const bodySchema = z.object({
  orderId: z.string().min(1),
  receiptUrl: z.string().url(),
  guestEmail: z.string().email().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
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

  const { orderId, receiptUrl, guestEmail } = parsed.data;
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.paymentGateway !== PaymentGateway.BANK_TRANSFER) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.paymentStatus !== PaymentStatus.PENDING) {
    return NextResponse.json({ error: "Order is not awaiting payment" }, { status: 400 });
  }

  if (order.userId) {
    if (session?.user?.id !== order.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    const ge = guestEmail?.trim().toLowerCase();
    if (!ge || ge !== (order.guestEmail ?? "").toLowerCase()) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { paymentReceiptUrl: receiptUrl },
  });

  const clientName = order.guestName ?? session?.user?.name ?? "Client";
  const clientEmail = order.guestEmail ?? session?.user?.email ?? guestEmail;
  if (clientEmail) {
    void sendBankTransferReceiptReceivedEmail({
      to: clientEmail,
      clientName,
      ref: order.orderNumber,
      amountNGN: order.total,
    });
  }
  void sendBankTransferAdminNotification({
    ref: order.orderNumber,
    clientName,
    amountNGN: order.total,
    receiptUrl,
  });

  return NextResponse.json({
    success: true,
    redirectUrl: `${getPublicAppUrl()}/payment/pending?reference=${encodeURIComponent(order.orderNumber)}&type=order`,
  });
}
