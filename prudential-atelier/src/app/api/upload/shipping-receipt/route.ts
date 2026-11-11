import { NextRequest, NextResponse } from "next/server";
import { PaymentMethod, PaymentPurpose, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { rateLimitOr429 } from "@/lib/rate-limit";
import { dailyUploadCapOr429 } from "@/lib/upload-limits";
import { storePrivateUpload } from "@/lib/media/private-upload";
import { appendPayment, resolveClientId } from "@/lib/payments/ledger";
import { generatePaymentReference } from "@/lib/payments/index";
import { rtwGatewayEmail, rtwGatewayName } from "@/lib/payments/payer-email";
import { sendBankTransferAdminNotification, sendBankTransferReceiptReceivedEmail } from "@/lib/email";
import { notifyBankTransferReceipt } from "@/lib/notifications";
import { findPendingShippingReceipt, shippingAmountDueNGN } from "@/lib/shipping/due";
import { verifyShippingPayCode } from "@/lib/shipping/pay-link";

const FOLDER = "prudential-atelier/receipts";

/**
 * A bank-transfer receipt for a quoted shipping fee, from the shipping pay page.
 * The lasting pay-link code is the permission, so guests need no sign-in.
 * The receipt becomes a PENDING ledger payment that admin approves or rejects
 * under Payments (or on the order); approval marks the shipping paid.
 */
export async function POST(req: NextRequest) {
  const limited = await rateLimitOr429(req, "shipping-receipt", 6, 15 * 60 * 1000);
  if (limited) return limited;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }
  const orderId = String(form.get("orderId") ?? "");
  const code = String(form.get("c") ?? "");
  if (!orderId || !verifyShippingPayCode(orderId, code)) {
    return NextResponse.json({ error: "This link is not valid" }, { status: 404 });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: { select: { email: true, name: true } } },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  const dueNGN = shippingAmountDueNGN(order);
  if (dueNGN <= 0) {
    return NextResponse.json({ error: "Shipping for this order is already paid" }, { status: 400 });
  }
  if (await findPendingShippingReceipt(order.id)) {
    return NextResponse.json(
      { error: "We already have your receipt and are checking it. We will email you once it is confirmed." },
      { status: 409 },
    );
  }

  const capped = await dailyUploadCapOr429("receipt-upload");
  if (capped) return capped;
  const up = await storePrivateUpload(form.get("file"), {
    folder: FOLDER,
    errorType: "SHIPPING_RECEIPT_UPLOAD",
    fallbackName: "shipping-receipt",
  });
  if (!up.ok) return up.response;
  const receiptUrl = up.stored.url;

  const clientEmail = rtwGatewayEmail(order);
  const clientName = rtwGatewayName(order);
  const clientId = await resolveClientId({ userId: order.userId, email: clientEmail });

  await appendPayment({
    reference: generatePaymentReference("SHIPBT"),
    amount: dueNGN,
    currency: "NGN",
    method: PaymentMethod.BANK_TRANSFER,
    status: PaymentStatus.PENDING,
    purpose: PaymentPurpose.BALANCE,
    receiptUrl,
    orderId: order.id,
    clientId,
    gatewayPayload: { kind: "shipping-receipt" },
  });

  const ref = `${order.orderNumber} (shipping)`;
  if (clientEmail) {
    void sendBankTransferReceiptReceivedEmail({
      to: clientEmail,
      clientName,
      ref,
      amountNGN: dueNGN,
      brand: "main",
      receiptUrl,
    });
  }
  void sendBankTransferAdminNotification({
    ref,
    clientName,
    amountNGN: dueNGN,
    receiptUrl,
    adminPath: `/admin/orders/${order.id}`,
  });
  notifyBankTransferReceipt({
    ref,
    clientName,
    amountNGN: dueNGN,
    link: `/admin/orders/${order.id}`,
    entityId: order.id,
  });

  return NextResponse.json({ success: true });
}
