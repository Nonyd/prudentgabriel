import { OrderStatus, PaymentGateway, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { awardPurchasePoints } from "@/lib/points";

export async function fulfillPaidOrder(params: {
  orderId: string;
  paymentRef: string;
  gateway?: PaymentGateway;
}): Promise<boolean> {
  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    select: { id: true, paymentStatus: true, userId: true, total: true },
  });

  if (!order || order.paymentStatus !== PaymentStatus.PENDING) {
    return false;
  }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentStatus: PaymentStatus.PAID,
      paidAt: new Date(),
      paymentRef: params.paymentRef,
      status: OrderStatus.CONFIRMED,
      ...(params.gateway ? { paymentGateway: params.gateway } : {}),
    },
  });

  if (order.userId) {
    void awardPurchasePoints(order.userId, order.total, order.id).catch((e) =>
      console.warn("[fulfillPaidOrder] points", e),
    );
  }

  return true;
}
