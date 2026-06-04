import { NextResponse } from "next/server";
import { PaymentGateway, PaymentStatus } from "@prisma/client";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { parseBespokePaymentRef } from "@/lib/bespoke-order-access";

export async function GET() {
  const session = await requireAdminApi();
  if (!session.ok) return session.response;

  const [orders, bookings, bespokes] = await Promise.all([
    prisma.order.findMany({
      where: {
        paymentGateway: PaymentGateway.BANK_TRANSFER,
        paymentStatus: PaymentStatus.PENDING,
        paymentReceiptUrl: { not: null },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        orderNumber: true,
        total: true,
        paymentReceiptUrl: true,
        createdAt: true,
        guestName: true,
        guestEmail: true,
        user: { select: { name: true, email: true } },
      },
    }),
    prisma.consultationBooking.findMany({
      where: {
        paymentGateway: PaymentGateway.BANK_TRANSFER,
        paymentStatus: PaymentStatus.PENDING,
        paymentReceiptUrl: { not: null },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        bookingNumber: true,
        feeNGN: true,
        paymentReceiptUrl: true,
        createdAt: true,
        clientName: true,
        clientEmail: true,
      },
    }),
    prisma.bespokeOrder.findMany({
      where: {
        paymentGateway: PaymentGateway.BANK_TRANSFER,
        paymentReceiptUrl: { not: null },
        balance: { gt: 0 },
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        orderRef: true,
        balance: true,
        paymentReceiptUrl: true,
        paymentRef: true,
        updatedAt: true,
        clientName: true,
        clientEmail: true,
      },
    }),
  ]);

  const items = [
    ...orders.map((o) => ({
      id: `order-${o.id}`,
      kind: "ORDER" as const,
      ref: o.orderNumber,
      clientName: o.user?.name ?? o.guestName ?? "—",
      clientEmail: o.user?.email ?? o.guestEmail ?? "",
      amountNGN: o.total,
      receiptUrl: o.paymentReceiptUrl!,
      submittedAt: o.createdAt.toISOString(),
    })),
    ...bookings.map((b) => ({
      id: `booking-${b.id}`,
      kind: "CONSULTATION" as const,
      ref: b.bookingNumber,
      clientName: b.clientName,
      clientEmail: b.clientEmail,
      amountNGN: b.feeNGN,
      receiptUrl: b.paymentReceiptUrl!,
      submittedAt: b.createdAt.toISOString(),
    })),
    ...bespokes.map((b) => {
      const parsed = parseBespokePaymentRef(b.paymentRef);
      return {
      id: `bespoke-${b.id}`,
      kind: "BESPOKE" as const,
      ref: b.orderRef,
      clientName: b.clientName,
      clientEmail: b.clientEmail,
      amountNGN: parsed.amountNGN ?? b.balance,
      receiptUrl: b.paymentReceiptUrl!,
      submittedAt: b.updatedAt.toISOString(),
    };
    }),
  ].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

  return NextResponse.json({ items });
}
