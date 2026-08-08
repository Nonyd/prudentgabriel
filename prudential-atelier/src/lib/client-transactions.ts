import type { Currency, PaymentGateway, PaymentStatus } from "@prisma/client";
import { PaymentStatus as PaymentStatusEnum } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getOrCreateClientProfile } from "@/lib/account-helpers";
import { getClientPayments } from "@/lib/payments/ledger";

export type ClientTransactionKind =
  | "rtw_order"
  | "consultation"
  | "bespoke"
  | "bespoke_request"
  | "ledger";

export type ClientTransaction = {
  id: string;
  kind: ClientTransactionKind;
  date: Date;
  label: string;
  detail: string | null;
  amount: number;
  currency: Currency;
  status: PaymentStatus;
  gateway: PaymentGateway | null;
  reference: string | null;
  href: string | null;
};

const PAID_STATUSES: PaymentStatus[] = [
  PaymentStatusEnum.PAID,
  PaymentStatusEnum.REFUNDED,
];

export async function getClientTransactions(
  userId: string,
  email: string,
): Promise<ClientTransaction[]> {
  const profile = await getOrCreateClientProfile(userId);
  const emailLower = email.toLowerCase();

  const [rtwOrders, consultations, bespokeOrders, bespokeRequests, ledgerPayments] = await Promise.all([
    prisma.order.findMany({
      where: {
        userId,
        isBespoke: false,
        paymentStatus: { in: PAID_STATUSES },
      },
      select: {
        id: true,
        orderNumber: true,
        total: true,
        currency: true,
        paymentStatus: true,
        paymentGateway: true,
        paymentRef: true,
        paidAt: true,
        createdAt: true,
        items: { take: 1, select: { product: { select: { name: true } } } },
      },
    }),
    prisma.consultationBooking.findMany({
      where: {
        paymentStatus: { in: PAID_STATUSES },
        OR: [{ userId }, { clientEmail: emailLower }],
      },
      select: {
        id: true,
        bookingNumber: true,
        feeNGN: true,
        currency: true,
        paymentStatus: true,
        paymentGateway: true,
        paymentRef: true,
        paidAt: true,
        createdAt: true,
        consultant: { select: { name: true } },
        offering: { select: { sessionType: true } },
      },
    }),
    prisma.bespokeOrder.findMany({
      where: {
        clientProfileId: profile.id,
        amountPaid: { gt: 0 },
      },
      select: {
        id: true,
        orderRef: true,
        amountPaid: true,
        paymentGateway: true,
        paymentRef: true,
        updatedAt: true,
        createdAt: true,
        outfitDescription: true,
      },
    }),
    prisma.bespokeRequest.findMany({
      where: {
        AND: [
          { OR: [{ userId }, { email: emailLower }] },
          {
            OR: [
              { depositPaid: { gt: 0 } },
              { balancePaymentStatus: PaymentStatusEnum.PAID },
            ],
          },
        ],
      },
      select: {
        id: true,
        requestNumber: true,
        depositPaid: true,
        agreedPrice: true,
        balancePaymentStatus: true,
        balancePaystackRef: true,
        paymentMethod: true,
        updatedAt: true,
        createdAt: true,
        occasion: true,
      },
    }),
    getClientPayments({ userId, email }),
  ]);

  const ledgerConsultationIds = new Set(
    ledgerPayments.filter((p) => p.consultationId).map((p) => p.consultationId!),
  );
  const ledgerBespokeIds = new Set(
    ledgerPayments.filter((p) => p.bespokeOrderId).map((p) => p.bespokeOrderId!),
  );
  const ledgerRtwIds = new Set(ledgerPayments.filter((p) => p.orderId).map((p) => p.orderId!));

  const rows: ClientTransaction[] = [];

  for (const p of ledgerPayments) {
    rows.push({
      id: `ledger-${p.id}`,
      kind: "ledger",
      date: p.confirmedAt ?? p.createdAt,
      label:
        p.purpose === "CONSULTATION"
          ? "Consultation"
          : p.purpose === "RTW_ORDER"
            ? "Ready-to-wear order"
            : p.purpose === "DEPOSIT"
              ? "Commission deposit"
              : p.purpose === "BALANCE"
                ? "Commission balance"
                : p.purpose === "FULL"
                  ? "Commission payment"
                  : "Payment",
      detail: p.reference,
      amount: Number(p.amount),
      currency: (p.currency as Currency) || "NGN",
      status: p.status,
      gateway: null,
      reference: p.reference,
      href: p.bespokeOrderId
        ? "/account/orders"
        : p.consultationId
          ? `/account/consultations/${p.consultationId}`
          : p.orderId
            ? `/account/orders/${p.orderId}`
            : null,
    });
  }

  for (const o of rtwOrders) {
    if (ledgerRtwIds.has(o.id)) continue;
    rows.push({
      id: `order-${o.id}`,
      kind: "rtw_order",
      date: o.paidAt ?? o.createdAt,
      label: "Ready-to-wear order",
      detail: o.items[0]?.product.name ?? o.orderNumber,
      amount: o.total,
      currency: o.currency,
      status: o.paymentStatus,
      gateway: o.paymentGateway,
      reference: o.paymentRef,
      href: `/account/orders/${o.id}`,
    });
  }

  for (const b of consultations) {
    if (ledgerConsultationIds.has(b.id)) continue;
    rows.push({
      id: `consultation-${b.id}`,
      kind: "consultation",
      date: b.paidAt ?? b.createdAt,
      label: "Consultation",
      detail: `${b.consultant.name} · ${b.bookingNumber}`,
      amount: b.feeNGN,
      currency: b.currency,
      status: b.paymentStatus,
      gateway: b.paymentGateway,
      reference: b.paymentRef,
      href: `/account/consultations/${b.id}`,
    });
  }

  for (const o of bespokeOrders) {
    if (ledgerBespokeIds.has(o.id)) continue;
    rows.push({
      id: `bespoke-${o.id}`,
      kind: "bespoke",
      date: o.updatedAt ?? o.createdAt,
      label: "Commission payment",
      detail: o.outfitDescription?.trim() || o.orderRef,
      amount: o.amountPaid,
      currency: "NGN",
      status: PaymentStatusEnum.PAID,
      gateway: o.paymentGateway,
      reference: o.paymentRef,
      href: `/account/orders`,
    });
  }

  for (const r of bespokeRequests) {
    const paidDeposit = (r.depositPaid ?? 0) > 0;
    const paidBalance = r.balancePaymentStatus === PaymentStatusEnum.PAID;
    if (!paidDeposit && !paidBalance) continue;

    const amount =
      paidBalance && r.agreedPrice
        ? r.agreedPrice
        : paidDeposit
          ? (r.depositPaid ?? 0)
          : 0;
    if (amount <= 0) continue;

    rows.push({
      id: `bespoke-req-${r.id}`,
      kind: "bespoke_request",
      date: r.updatedAt ?? r.createdAt,
      label: paidBalance ? "Bespoke balance" : "Bespoke deposit",
      detail: `${r.occasion} · ${r.requestNumber}`,
      amount,
      currency: "NGN",
      status: PaymentStatusEnum.PAID,
      gateway: r.balancePaystackRef ? "PAYSTACK" : null,
      reference: r.balancePaystackRef,
      href: null,
    });
  }

  rows.sort((a, b) => b.date.getTime() - a.date.getTime());
  return rows;
}

export function formatTransactionStatus(status: PaymentStatus): string {
  switch (status) {
    case PaymentStatusEnum.PAID:
      return "Paid";
    case PaymentStatusEnum.REFUNDED:
      return "Refunded";
    case PaymentStatusEnum.PENDING:
      return "Pending";
    case PaymentStatusEnum.FAILED:
      return "Failed";
    case PaymentStatusEnum.CONFIRMED:
      return "Confirmed";
    case PaymentStatusEnum.REJECTED:
      return "Rejected";
    default:
      return status;
  }
}

export function formatGateway(gateway: PaymentGateway | null): string {
  if (!gateway) return "—";
  return gateway.replace(/_/g, " ");
}
