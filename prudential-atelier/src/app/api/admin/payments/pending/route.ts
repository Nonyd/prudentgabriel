import { NextResponse } from "next/server";
import { PaymentGateway, PaymentStatus } from "@prisma/client";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { parseBespokePaymentRef } from "@/lib/bespoke-order-access";
import { toNumber } from "@/lib/payments/ledger";
import {
  resolveBankAccount,
  toPublicBankAccount,
  type BusinessLineCode,
} from "@/lib/payments/bank-account";

async function accountFor(currency: string, line: BusinessLineCode) {
  const row = await resolveBankAccount(currency, line, { activeOnly: false });
  if (!row) return { currency, businessLine: line, bankName: "", accountNumber: "", accountName: "", accountId: null as string | null };
  const pub = toPublicBankAccount({ ...row, isActive: true }) ?? {
    bankName: row.bankName,
    accountNumber: row.accountNumber,
    accountName: row.accountName,
  };
  return {
    currency: row.currency,
    businessLine: line,
    bankName: pub.bankName,
    accountNumber: pub.accountNumber,
    accountName: pub.accountName,
    accountId: row.id,
    isActive: row.isActive,
  };
}

export async function GET() {
  const session = await requireAdminApi("payments");
  if (!session.ok) return session.response;

  const [orders, bookings, bespokes, pendingLedger] = await Promise.all([
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
        currency: true,
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
        currency: true,
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
    prisma.payment.findMany({
      where: {
        status: PaymentStatus.PENDING,
        method: "BANK_TRANSFER",
        OR: [{ bespokeOrderId: { not: null } }, { orderId: { not: null } }, { consultationId: { not: null } }],
      },
      orderBy: { createdAt: "desc" },
      include: {
        bespokeOrder: { select: { id: true, orderRef: true, clientName: true, clientEmail: true } },
        order: {
          select: {
            id: true,
            orderNumber: true,
            guestName: true,
            guestEmail: true,
            currency: true,
            user: { select: { name: true, email: true } },
          },
        },
        consultation: {
          select: { id: true, bookingNumber: true, clientName: true, clientEmail: true, currency: true },
        },
      },
    }),
  ]);

  const bespokeIdsWithLedger = new Set(
    pendingLedger.filter((p) => p.bespokeOrderId).map((p) => p.bespokeOrderId!),
  );

  const items = [
    ...orders.map((o) => ({
      id: `order-${o.id}`,
      kind: "ORDER" as const,
      ref: o.orderNumber,
      clientName: o.user?.name ?? o.guestName ?? "—",
      clientEmail: o.user?.email ?? o.guestEmail ?? "",
      amountNGN: o.total,
      currency: String(o.currency),
      businessLine: "RTW" as const,
      href: `/admin/orders/${o.id}`,
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
      currency: String(b.currency),
      businessLine: "ATELIER" as const,
      href: `/admin/consultations/${b.id}`,
      receiptUrl: b.paymentReceiptUrl!,
      submittedAt: b.createdAt.toISOString(),
    })),
    ...pendingLedger
      .filter((p) => p.bespokeOrder)
      .map((p) => ({
        id: `bespoke-${p.bespokeOrder!.id}`,
        kind: "BESPOKE" as const,
        ref: p.bespokeOrder!.orderRef,
        clientName: p.bespokeOrder!.clientName,
        clientEmail: p.bespokeOrder!.clientEmail,
        amountNGN: toNumber(p.amount),
        currency: p.currency || "NGN",
        businessLine: "ATELIER" as const,
        href: `/admin/bespoke/${p.bespokeOrder!.id}`,
        receiptUrl: p.receiptUrl ?? "",
        submittedAt: p.createdAt.toISOString(),
        paymentId: p.id,
      })),
    ...bespokes
      .filter((b) => !bespokeIdsWithLedger.has(b.id))
      .map((b) => {
        const parsed = parseBespokePaymentRef(b.paymentRef);
        return {
          id: `bespoke-${b.id}`,
          kind: "BESPOKE" as const,
          ref: b.orderRef,
          clientName: b.clientName,
          clientEmail: b.clientEmail,
          amountNGN: parsed.amountNGN ?? b.balance,
          currency: "NGN",
          businessLine: "ATELIER" as const,
          href: `/admin/bespoke/${b.id}`,
          receiptUrl: b.paymentReceiptUrl!,
          submittedAt: b.updatedAt.toISOString(),
        };
      }),
  ].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

  const keys = Array.from(new Set(items.map((i) => `${i.currency}:${i.businessLine}`)));
  const accounts = await Promise.all(
    keys.map(async (k) => {
      const [currency, line] = k.split(":") as [string, BusinessLineCode];
      return [k, await accountFor(currency, line)] as const;
    }),
  );
  const accountMap = Object.fromEntries(accounts);

  return NextResponse.json({
    items: items.map((item) => ({
      ...item,
      account: accountMap[`${item.currency}:${item.businessLine}`] ?? null,
    })),
  });
}
