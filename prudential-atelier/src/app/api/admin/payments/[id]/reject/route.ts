import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PaymentGateway, PaymentStatus } from "@prisma/client";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { sendPaymentRejectedEmail } from "@/lib/email";
import { logActivity } from "@/lib/logger";

const bodySchema = z.object({
  reason: z.string().min(1).max(500),
});

function parsePaymentId(id: string): { kind: "ORDER" | "CONSULTATION" | "BESPOKE"; recordId: string } | null {
  if (id.startsWith("order-")) return { kind: "ORDER", recordId: id.slice(6) };
  if (id.startsWith("booking-")) return { kind: "CONSULTATION", recordId: id.slice(8) };
  if (id.startsWith("bespoke-")) return { kind: "BESPOKE", recordId: id.slice(8) };
  return null;
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsedBody = bodySchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: parsedBody.error.flatten() }, { status: 400 });
  }

  const { id } = await ctx.params;
  const parsed = parsePaymentId(id);
  if (!parsed) {
    return NextResponse.json({ error: "Invalid payment id" }, { status: 400 });
  }

  const { reason } = parsedBody.data;
  const adminEmail = gate.session.user?.email ?? undefined;
  const adminId = gate.session.user?.id;

  if (parsed.kind === "ORDER") {
    const order = await prisma.order.findUnique({ where: { id: parsed.recordId } });
    if (!order || order.paymentGateway !== PaymentGateway.BANK_TRANSFER) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: PaymentStatus.FAILED },
    });
    const email = order.guestEmail ?? (await prisma.user.findUnique({ where: { id: order.userId ?? "" }, select: { email: true } }))?.email;
    if (email) {
      void sendPaymentRejectedEmail({ to: email, ref: order.orderNumber, amountNGN: order.total, reason });
    }
    void logActivity({
      userId: adminId,
      userEmail: adminEmail,
      userRole: gate.session.user?.role,
      action: "PAYMENT_CONFIRM",
      module: "payments",
      description: `Rejected bank transfer for order ${order.orderNumber}: ${reason}`,
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
    await prisma.consultationBooking.update({
      where: { id: booking.id },
      data: { paymentStatus: PaymentStatus.FAILED },
    });
    void sendPaymentRejectedEmail({
      to: booking.clientEmail,
      ref: booking.bookingNumber,
      amountNGN: booking.feeNGN,
      reason,
    });
    void logActivity({
      userId: adminId,
      userEmail: adminEmail,
      userRole: gate.session.user?.role,
      action: "PAYMENT_CONFIRM",
      module: "payments",
      description: `Rejected bank transfer for booking ${booking.bookingNumber}: ${reason}`,
      recordId: booking.id,
      recordType: "ConsultationBooking",
    });
    return NextResponse.json({ success: true });
  }

  const bespoke = await prisma.bespokeOrder.findUnique({ where: { id: parsed.recordId } });
  if (!bespoke || bespoke.paymentGateway !== PaymentGateway.BANK_TRANSFER) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.bespokeOrder.update({
    where: { id: bespoke.id },
    data: { paymentReceiptUrl: null, paymentGateway: null, paymentRef: null },
  });
  void sendPaymentRejectedEmail({
    to: bespoke.clientEmail,
    ref: bespoke.orderRef,
    amountNGN: bespoke.balance,
    reason,
  });
  void logActivity({
    userId: adminId,
    userEmail: adminEmail,
    userRole: gate.session.user?.role,
    action: "PAYMENT_CONFIRM",
    module: "payments",
    description: `Rejected bank transfer for bespoke ${bespoke.orderRef}: ${reason}`,
    recordId: bespoke.id,
    recordType: "BespokeOrder",
  });

  return NextResponse.json({ success: true });
}
