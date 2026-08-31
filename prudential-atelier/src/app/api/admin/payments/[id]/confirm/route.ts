import { NextRequest, NextResponse } from "next/server";
import { PaymentGateway, PaymentPurpose, PaymentStatus } from "@prisma/client";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { fulfillPaidOrder } from "@/lib/order-payment";
import { fulfillPaidConsultationBooking } from "@/lib/consultation-payment";
import { fulfillBespokeOrderBalance } from "@/lib/bespoke-order-payment";
import { sendPaymentConfirmedEmail } from "@/lib/email";
import { notifyBankTransferConfirmed, notifyPaymentConfirmed } from "@/lib/customer-notifications";
import { logActivity } from "@/lib/logger";
import { getPublicAppUrl } from "@/lib/app-url";
import { rtwOrderSuccessPath } from "@/lib/atelier-storefront";
import {
  appendPayment,
  confirmPayment,
  gatewayToPaymentMethod,
  resolveClientId,
  toNumber,
} from "@/lib/payments/ledger";
import { rtwHasOutstandingBalance } from "@/lib/payments/rtw-totals";
import { generatePaymentReference } from "@/lib/payments/index";
import { feeShortfallWithinTolerance, resolveBankAccount, type BusinessLineCode } from "@/lib/payments/bank-account";

function parsePaymentId(
  id: string,
): { kind: "ORDER" | "CONSULTATION" | "BESPOKE" | "PAYMENT"; recordId: string } | null {
  if (id.startsWith("order-")) return { kind: "ORDER", recordId: id.slice(6) };
  if (id.startsWith("booking-")) return { kind: "CONSULTATION", recordId: id.slice(8) };
  if (id.startsWith("bespoke-")) return { kind: "BESPOKE", recordId: id.slice(8) };
  if (id.startsWith("payment-")) return { kind: "PAYMENT", recordId: id.slice(8) };
  return null;
}

function parseArrivedAmount(req: NextRequest): Promise<number | undefined> {
  return req.json().then((body: unknown) => {
    if (!body || typeof body !== "object") return undefined;
    const n = Number((body as { arrivedAmount?: unknown }).arrivedAmount);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  }).catch(() => undefined);
}

async function rejectIfShortOfTolerance(params: {
  expected: number;
  arrived: number | undefined;
  currency: string;
  line: BusinessLineCode;
}): Promise<NextResponse | null> {
  if (params.arrived == null) return null;
  const account = await resolveBankAccount(params.currency, params.line, { activeOnly: false });
  const tolerance = account?.feeTolerance ?? 0;
  if (feeShortfallWithinTolerance(params.expected, params.arrived, tolerance)) return null;
  return NextResponse.json(
    {
      error: `Arrived amount is short of the expected ${params.expected} ${params.currency} by more than the ${tolerance} tolerance on this account. Do not confirm as settled — the ship gate will block an unpaid shortfall.`,
    },
    { status: 400 },
  );
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi("payments");
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  const parsed = parsePaymentId(id);
  if (!parsed) {
    return NextResponse.json({ error: "Invalid payment id" }, { status: 400 });
  }

  const appUrl = getPublicAppUrl();
  const adminEmail = gate.session.user?.email ?? undefined;
  const adminId = gate.session.user?.id;
  const arrivedAmount = await parseArrivedAmount(req);

  if (parsed.kind === "PAYMENT") {
    const existing = await prisma.payment.findUnique({
      where: { id: parsed.recordId },
      include: { order: { select: { currency: true } }, consultation: { select: { currency: true } } },
    });
    if (existing) {
      const line: BusinessLineCode = existing.orderId ? "RTW" : "ATELIER";
      const currency = existing.order?.currency
        ? String(existing.order.currency)
        : existing.consultation?.currency
          ? String(existing.consultation.currency)
          : existing.currency;
      const blocked = await rejectIfShortOfTolerance({
        expected: toNumber(existing.amount),
        arrived: arrivedAmount,
        currency,
        line,
      });
      if (blocked) return blocked;
    }
    const payment = await confirmPayment({
      paymentId: parsed.recordId,
      confirmedById: adminId,
    });
    void logActivity({
      userId: adminId,
      userEmail: adminEmail,
      userRole: gate.session.user?.role,
      action: "PAYMENT_CONFIRM",
      module: "payments",
      description: `Confirmed ledger payment ${payment.reference}`,
      recordId: payment.id,
      recordType: "Payment",
    });
    return NextResponse.json({ success: true, paymentId: payment.id });
  }

  if (parsed.kind === "ORDER") {
    const order = await prisma.order.findUnique({ where: { id: parsed.recordId } });
    if (!order || order.paymentGateway !== PaymentGateway.BANK_TRANSFER) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const blocked = await rejectIfShortOfTolerance({
      expected: order.total,
      arrived: arrivedAmount,
      currency: String(order.currency),
      line: "RTW",
    });
    if (blocked) return blocked;
    const followUp = rtwHasOutstandingBalance(order);
    const ref = followUp ? generatePaymentReference("BAL") : order.paymentRef ?? order.orderNumber;
    await fulfillPaidOrder({
      orderId: order.id,
      paymentRef: ref,
      gateway: PaymentGateway.BANK_TRANSFER,
    });

    const clientId = await resolveClientId({
      userId: order.userId,
      email: order.guestEmail,
    });
    const existingLedger = await prisma.payment.findUnique({ where: { reference: ref } });
    if (!existingLedger) {
      await appendPayment({
        reference: ref,
        amount: order.total,
        method: gatewayToPaymentMethod(PaymentGateway.BANK_TRANSFER),
        status: PaymentStatus.CONFIRMED,
        purpose: PaymentPurpose.RTW_ORDER,
        receiptUrl: order.paymentReceiptUrl,
        orderId: order.id,
        clientId,
        confirmedById: adminId,
        confirmedAt: new Date(),
      });
    }

    const email = order.guestEmail ?? (await prisma.user.findUnique({ where: { id: order.userId ?? "" }, select: { email: true } }))?.email;
    if (email) {
      void sendPaymentConfirmedEmail({
        to: email,
        ref: order.orderNumber,
        amountNGN: order.total,
        kind: "order",
        trackUrl: `${appUrl}${rtwOrderSuccessPath(order.orderNumber, email)}`,
      });
      notifyPaymentConfirmed({
        userId: order.userId,
        clientEmail: email,
        ref: order.orderNumber,
        link: `${appUrl}/account/orders`,
        entityId: order.id,
      });
      notifyBankTransferConfirmed({
        userId: order.userId,
        clientEmail: email,
        ref: order.orderNumber,
        link: `${appUrl}/account/orders`,
        entityId: order.id,
      });
    }
    void logActivity({
      userId: adminId,
      userEmail: adminEmail,
      userRole: gate.session.user?.role,
      action: "PAYMENT_CONFIRM",
      module: "payments",
      description: `Confirmed bank transfer for order ${order.orderNumber}`,
      recordId: order.id,
      recordType: "Order",
    });
    return NextResponse.json({ success: true });
  }

  if (parsed.kind === "CONSULTATION") {
    const booking = await prisma.consultationBooking.findUnique({ where: { id: parsed.recordId } });
    if (!booking || booking.paymentGateway !== PaymentGateway.BANK_TRANSFER) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const blocked = await rejectIfShortOfTolerance({
      expected: booking.feeNGN,
      arrived: arrivedAmount,
      currency: String(booking.currency),
      line: "ATELIER",
    });
    if (blocked) return blocked;
    const ref = booking.paymentRef ?? booking.bookingNumber;
    await fulfillPaidConsultationBooking({
      bookingId: booking.id,
      paymentRef: ref,
      gateway: PaymentGateway.BANK_TRANSFER,
    });

    const clientId = await resolveClientId({
      userId: booking.userId,
      email: booking.clientEmail,
    });
    const existingLedger = await prisma.payment.findUnique({ where: { reference: ref } });
    if (!existingLedger) {
      await appendPayment({
        reference: ref,
        amount: booking.feeNGN,
        method: gatewayToPaymentMethod(PaymentGateway.BANK_TRANSFER),
        status: PaymentStatus.CONFIRMED,
        purpose: PaymentPurpose.CONSULTATION,
        receiptUrl: booking.paymentReceiptUrl,
        consultationId: booking.id,
        clientId,
        confirmedById: adminId,
        confirmedAt: new Date(),
      });
    }

    void sendPaymentConfirmedEmail({
      to: booking.clientEmail,
      ref: booking.bookingNumber,
      amountNGN: booking.feeNGN,
      kind: "consultation",
      trackUrl: `${appUrl}/consultation/${encodeURIComponent(booking.bookingNumber)}`,
    });
    notifyPaymentConfirmed({
      userId: booking.userId,
      clientEmail: booking.clientEmail,
      ref: booking.bookingNumber,
      link: `${appUrl}/account/consultations`,
      entityId: booking.id,
    });
    notifyBankTransferConfirmed({
      userId: booking.userId,
      clientEmail: booking.clientEmail,
      ref: booking.bookingNumber,
      link: `${appUrl}/account/consultations`,
      entityId: booking.id,
    });
    void logActivity({
      userId: adminId,
      userEmail: adminEmail,
      userRole: gate.session.user?.role,
      action: "PAYMENT_CONFIRM",
      module: "payments",
      description: `Confirmed bank transfer for booking ${booking.bookingNumber}`,
      recordId: booking.id,
      recordType: "ConsultationBooking",
    });
    return NextResponse.json({ success: true });
  }

  const bespoke = await prisma.bespokeOrder.findUnique({ where: { id: parsed.recordId } });
  if (!bespoke || bespoke.paymentGateway !== PaymentGateway.BANK_TRANSFER) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pending = await prisma.payment.findFirst({
    where: { bespokeOrderId: bespoke.id, status: PaymentStatus.PENDING },
    orderBy: { createdAt: "desc" },
  });

  const refParts = (bespoke.paymentRef ?? "").split("|");
  const parsedAmount = refParts.length > 1 ? Number(refParts[1]) : NaN;
  const payAmount = pending
    ? toNumber(pending.amount)
    : Number.isFinite(parsedAmount) && parsedAmount > 0
      ? Math.min(parsedAmount, bespoke.balance)
      : bespoke.balance;
  const paymentRef = pending?.reference ?? (refParts[0] || bespoke.orderRef);

  const blocked = await rejectIfShortOfTolerance({
    expected: payAmount,
    arrived: arrivedAmount,
    currency: pending?.currency || "NGN",
    line: "ATELIER",
  });
  if (blocked) return blocked;

  await fulfillBespokeOrderBalance({
    orderId: bespoke.id,
    amount: payAmount,
    paymentRef,
    gateway: PaymentGateway.BANK_TRANSFER,
    confirmedById: adminId,
    receiptUrl: bespoke.paymentReceiptUrl,
  });

  void sendPaymentConfirmedEmail({
    to: bespoke.clientEmail,
    ref: bespoke.orderRef,
    amountNGN: payAmount,
    kind: "bespoke",
    trackUrl: `${appUrl}/track/${encodeURIComponent(bespoke.trackingToken)}`,
  });
  notifyPaymentConfirmed({
    userId: null,
    clientEmail: bespoke.clientEmail,
    ref: bespoke.orderRef,
    link: `${appUrl}/track/${encodeURIComponent(bespoke.trackingToken)}`,
    entityId: bespoke.id,
  });
  notifyBankTransferConfirmed({
    userId: null,
    clientEmail: bespoke.clientEmail,
    ref: bespoke.orderRef,
    link: `${appUrl}/track/${encodeURIComponent(bespoke.trackingToken)}`,
    entityId: bespoke.id,
  });
  void logActivity({
    userId: adminId,
    userEmail: adminEmail,
    userRole: gate.session.user?.role,
    action: "PAYMENT_CONFIRM",
    module: "payments",
    description: `Confirmed bank transfer for bespoke ${bespoke.orderRef}`,
    recordId: bespoke.id,
    recordType: "BespokeOrder",
  });

  return NextResponse.json({ success: true });
}
