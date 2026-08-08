import { PaymentGateway, PaymentPurpose, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { autoOnboardClient } from "@/lib/client-onboarding";
import {
  appendPayment,
  confirmPayment,
  gatewayToPaymentMethod,
  getOrderPaymentSummary,
  inferBespokePurpose,
  resolveClientId,
  toNumber,
} from "@/lib/payments/ledger";

/**
 * Record a confirmed bespoke payment on the ledger and refresh denormalised totals.
 * productionUnlockedAt is set/cleared by the ledger when depositSatisfied changes.
 * Stage advancement is owned by the stage-gate evaluator — this path does not mutate currentStage.
 */
export async function fulfillBespokeOrderBalance(params: {
  orderId: string;
  amount: number;
  paymentRef: string;
  gateway: PaymentGateway;
  confirmedById?: string | null;
  receiptUrl?: string | null;
  purpose?: PaymentPurpose;
}): Promise<boolean> {
  const order = await prisma.bespokeOrder.findUnique({
    where: { id: params.orderId },
    select: {
      id: true,
      balance: true,
      amountPaid: true,
      totalAmount: true,
      currentStage: true,
      clientEmail: true,
      clientName: true,
      clientPhone: true,
      clientProfileId: true,
      paymentReceiptUrl: true,
    },
  });

  if (!order || params.amount <= 0) {
    return false;
  }

  const summaryBefore = await getOrderPaymentSummary(order.id);
  if (params.amount > toNumber(summaryBefore.balance) + 0.01) {
    return false;
  }

  const existing = await prisma.payment.findUnique({
    where: { reference: params.paymentRef },
  });
  if (existing) {
    if (existing.status === PaymentStatus.CONFIRMED && existing.bespokeOrderId === order.id) {
      return true;
    }
    if (existing.status === PaymentStatus.PENDING && existing.bespokeOrderId === order.id) {
      await confirmPayment({
        paymentId: existing.id,
        confirmedById: params.confirmedById,
      });
    } else {
      return false;
    }
  } else {
    const purpose =
      params.purpose ??
      inferBespokePurpose({
        amount: params.amount,
        balanceBefore: toNumber(summaryBefore.balance),
        depositRequired: toNumber(summaryBefore.depositRequired),
        confirmedBefore: toNumber(summaryBefore.confirmed),
      });

    const clientId = await resolveClientId({ email: order.clientEmail });

    await appendPayment({
      reference: params.paymentRef,
      amount: params.amount,
      method: gatewayToPaymentMethod(params.gateway),
      status: PaymentStatus.CONFIRMED,
      purpose,
      receiptUrl: params.receiptUrl ?? order.paymentReceiptUrl,
      bespokeOrderId: order.id,
      clientId,
      confirmedById: params.confirmedById ?? null,
      confirmedAt: new Date(),
    });
  }

  await getOrderPaymentSummary(order.id);

  await prisma.bespokeOrder.update({
    where: { id: order.id },
    data: {
      paymentRef: params.paymentRef,
      paymentGateway: params.gateway,
      paymentReceiptUrl: null,
    },
  });

  if (!order.clientProfileId) {
    void autoOnboardClient({
      name: order.clientName,
      email: order.clientEmail,
      phone: order.clientPhone ?? undefined,
      source: "BESPOKE_ORDER",
      sourceId: order.id,
    }).catch((e) => console.warn("[fulfillBespokeOrderBalance] onboard", e));
  }

  return true;
}
