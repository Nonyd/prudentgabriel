import { OrderStatus, PaymentGateway, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { awardPurchasePoints } from "@/lib/points";
import { autoOnboardClient } from "@/lib/client-onboarding";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { notifyOrderConfirmed, notifyPaymentConfirmed } from "@/lib/customer-notifications";
import { getPublicAppUrl } from "@/lib/app-url";

export async function fulfillPaidOrder(params: {
  orderId: string;
  paymentRef: string;
  gateway?: PaymentGateway;
}): Promise<boolean> {
  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    include: {
      items: { include: { product: { select: { name: true } } } },
      user: { select: { id: true, email: true, name: true } },
    },
  });

  if (!order || order.paymentStatus !== PaymentStatus.PENDING) {
    return false;
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: PaymentStatus.PAID,
        paidAt: new Date(),
        paymentRef: params.paymentRef,
        status: OrderStatus.CONFIRMED,
        ...(params.gateway ? { paymentGateway: params.gateway } : {}),
      },
    });

    for (const item of order.items) {
      if (item.variantId) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { decrement: item.quantity } },
        });
      }
    }
  });

  let userId = order.userId;
  const clientEmail = order.guestEmail ?? order.user?.email;
  const clientName = order.guestName ?? order.user?.name ?? "Client";

  if (!userId && clientEmail) {
    const onboard = await autoOnboardClient({
      name: clientName,
      email: clientEmail,
      phone: order.guestPhone ?? undefined,
      source: "RTW_ORDER",
      sourceId: order.id,
    });
    userId = onboard.userId;
  }

  if (userId) {
    void awardPurchasePoints(userId, order.total, order.id).catch((e) =>
      console.warn("[fulfillPaidOrder] points", e),
    );
  }

  const emailTo = clientEmail;
  if (emailTo) {
    const snap = order.addressSnapshot as Record<string, string> | null;
    void sendOrderConfirmationEmail({
      to: emailTo,
      firstName: snap?.firstName ?? clientName.split(/\s+/)[0] ?? "Client",
      orderNumber: order.orderNumber,
      items: order.items.map((i) => ({
        name: i.product.name,
        size: i.size ?? "",
        color: i.color ?? "",
        qty: i.quantity,
        priceNGN: i.price,
      })),
      subtotalNGN: order.subtotal,
      totalNGN: order.total,
      shippingNGN: order.shippingAmount,
      discountNGN: order.discount,
      pointsDiscNGN: order.pointsDiscountNGN,
      addressSnapshot: snap ?? undefined,
    }).catch((e) => console.warn("[fulfillPaidOrder] email", e));
  }

  if (userId && clientEmail) {
    const appUrl = getPublicAppUrl();
    notifyPaymentConfirmed({
      userId,
      clientEmail,
      ref: order.orderNumber,
      link: `${appUrl}/account/orders`,
      entityId: order.id,
    });
    notifyOrderConfirmed({
      userId,
      orderId: order.id,
      orderNumber: order.orderNumber,
    });
  }

  return true;
}
