import { NextRequest, NextResponse } from "next/server";
import { PaymentGateway } from "@prisma/client";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { fulfillPaidOrder } from "@/lib/order-payment";
import { fulfillPaidConsultationBooking } from "@/lib/consultation-payment";
import { fulfillBespokeOrderBalance } from "@/lib/bespoke-order-payment";
import { sendPaymentConfirmedEmail } from "@/lib/email";
import { logActivity } from "@/lib/logger";
import { getPublicAppUrl } from "@/lib/app-url";

function parsePaymentId(id: string): { kind: "ORDER" | "CONSULTATION" | "BESPOKE"; recordId: string } | null {
  if (id.startsWith("order-")) return { kind: "ORDER", recordId: id.slice(6) };
  if (id.startsWith("booking-")) return { kind: "CONSULTATION", recordId: id.slice(8) };
  if (id.startsWith("bespoke-")) return { kind: "BESPOKE", recordId: id.slice(8) };
  return null;
}

export async function PATCH(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  const parsed = parsePaymentId(id);
  if (!parsed) {
    return NextResponse.json({ error: "Invalid payment id" }, { status: 400 });
  }

  const appUrl = getPublicAppUrl();
  const adminEmail = gate.session.user?.email ?? undefined;
  const adminId = gate.session.user?.id;

  if (parsed.kind === "ORDER") {
    const order = await prisma.order.findUnique({ where: { id: parsed.recordId } });
    if (!order || order.paymentGateway !== PaymentGateway.BANK_TRANSFER) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const ref = order.paymentRef ?? order.orderNumber;
    await fulfillPaidOrder({
      orderId: order.id,
      paymentRef: ref,
      gateway: PaymentGateway.BANK_TRANSFER,
    });
    const email = order.guestEmail ?? (await prisma.user.findUnique({ where: { id: order.userId ?? "" }, select: { email: true } }))?.email;
    if (email) {
      void sendPaymentConfirmedEmail({
        to: email,
        ref: order.orderNumber,
        amountNGN: order.total,
        kind: "order",
        trackUrl: `${appUrl}/track/${encodeURIComponent(order.orderNumber)}`,
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
    const ref = booking.paymentRef ?? booking.bookingNumber;
    await fulfillPaidConsultationBooking({
      bookingId: booking.id,
      paymentRef: ref,
      gateway: PaymentGateway.BANK_TRANSFER,
    });
    void sendPaymentConfirmedEmail({
      to: booking.clientEmail,
      ref: booking.bookingNumber,
      amountNGN: booking.feeNGN,
      kind: "consultation",
      trackUrl: `${appUrl}/consultation/${encodeURIComponent(booking.bookingNumber)}`,
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

  const refParts = (bespoke.paymentRef ?? "").split("|");
  const parsedAmount = refParts.length > 1 ? Number(refParts[1]) : NaN;
  const payAmount =
    Number.isFinite(parsedAmount) && parsedAmount > 0
      ? Math.min(parsedAmount, bespoke.balance)
      : bespoke.balance;
  const paymentRef = refParts[0] || bespoke.orderRef;
  await fulfillBespokeOrderBalance({
    orderId: bespoke.id,
    amount: payAmount,
    paymentRef,
    gateway: PaymentGateway.BANK_TRANSFER,
  });

  void sendPaymentConfirmedEmail({
    to: bespoke.clientEmail,
    ref: bespoke.orderRef,
    amountNGN: payAmount,
    kind: "bespoke",
    trackUrl: `${appUrl}/track/${encodeURIComponent(bespoke.trackingToken)}`,
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
