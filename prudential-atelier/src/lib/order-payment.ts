import {
  OrderStatus,
  PaymentGateway,
  PaymentPurpose,
  PaymentStatus,
  type PrismaClient,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { INTERACTIVE_TX } from "@/lib/prisma-tx";
import { awardPurchasePoints } from "@/lib/points";
import { autoOnboardClient } from "@/lib/client-onboarding";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { notifyOrderConfirmed, notifyPaymentConfirmed } from "@/lib/customer-notifications";
import { getPublicAppUrl } from "@/lib/app-url";
import { gatewayToPaymentMethod, resolveClientId } from "@/lib/payments/ledger";

export type OrderFulfillDb = Pick<PrismaClient, "$transaction" | "order">;

export async function fulfillPaidOrder(params: {
  orderId: string;
  paymentRef: string;
  gateway?: PaymentGateway;
  db?: OrderFulfillDb;
  clientId?: string;
  notify?: boolean;
}): Promise<boolean> {
  const db = params.db ?? prisma;
  const order = await db.order.findUnique({
    where: { id: params.orderId },
    include: {
      items: { include: { product: { select: { name: true } } } },
      user: { select: { id: true, email: true, name: true } },
    },
  });

  if (!order) return false;

  if (order.paymentStatus === PaymentStatus.PAID) {
    return true;
  }

  if (order.paymentStatus !== PaymentStatus.PENDING) {
    return false;
  }

  const clientId =
    params.clientId ??
    (await resolveClientId({
      userId: order.userId,
      email: order.guestEmail ?? order.user?.email,
    }));

  const claimed = await db.$transaction(async (tx) => {
    const flipped = await tx.order.updateMany({
      where: { id: order.id, paymentStatus: PaymentStatus.PENDING },
      data: {
        paymentStatus: PaymentStatus.PAID,
        paidAt: new Date(),
        paymentRef: params.paymentRef,
        status: OrderStatus.CONFIRMED,
        ...(params.gateway ? { paymentGateway: params.gateway } : {}),
      },
    });

    if (flipped.count === 0) {
      return false;
    }

    for (const item of order.items) {
      if (item.variantId) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { decrement: item.quantity } },
        });
      }
    }

    await tx.payment.create({
      data: {
        reference: params.paymentRef,
        amount: order.total,
        currency: String(order.currency),
        method: gatewayToPaymentMethod(params.gateway ?? null),
        status: PaymentStatus.CONFIRMED,
        purpose: PaymentPurpose.RTW_ORDER,
        orderId: order.id,
        clientId,
        confirmedAt: new Date(),
      },
    });

    return true;
  }, INTERACTIVE_TX);

  if (!claimed) {
    const latest = await db.order.findUnique({
      where: { id: order.id },
      select: { paymentStatus: true },
    });
    return latest?.paymentStatus === PaymentStatus.PAID;
  }

  if (params.notify === false) {
    return true;
  }

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
