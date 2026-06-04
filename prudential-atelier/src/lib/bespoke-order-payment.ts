import { BespokeStage, PaymentGateway } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { autoOnboardClient } from "@/lib/client-onboarding";

export async function fulfillBespokeOrderBalance(params: {
  orderId: string;
  amount: number;
  paymentRef: string;
  gateway: PaymentGateway;
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
    },
  });

  if (!order || params.amount <= 0 || params.amount > order.balance + 0.01) {
    return false;
  }

  const newPaid = order.amountPaid + params.amount;
  const newBalance = Math.max(0, order.totalAmount - newPaid);
  const advanceStage =
    newBalance <= 0 && order.currentStage === BespokeStage.PAYMENT_CONFIRMATION
      ? BespokeStage.SKETCHING_CONCEPT
      : undefined;

  await prisma.bespokeOrder.update({
    where: { id: order.id },
    data: {
      amountPaid: newPaid,
      balance: newBalance,
      paymentRef: params.paymentRef,
      paymentGateway: params.gateway,
      ...(advanceStage ? { currentStage: advanceStage } : {}),
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
