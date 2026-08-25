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
import { sendOrderConfirmationEmail, sendRtwFulfilmentRefusedEmails } from "@/lib/email";
import { notifyOrderConfirmed, notifyPaymentConfirmed } from "@/lib/customer-notifications";
import { createNotification } from "@/lib/notifications";
import { getPublicAppUrl } from "@/lib/app-url";
import { gatewayToPaymentMethod, resolveClientId } from "@/lib/payments/ledger";

export type OrderFulfillDb = Pick<PrismaClient, "$transaction" | "order">;

export class InsufficientVariantStockError extends Error {
  readonly variantId: string;
  readonly quantity: number;

  constructor(variantId: string, quantity: number) {
    super("INSUFFICIENT_VARIANT_STOCK");
    this.name = "InsufficientVariantStockError";
    this.variantId = variantId;
    this.quantity = quantity;
  }
}

const STOCK_REFUSE_NOTE =
  "Fulfilment refused: stock was insufficient after payment. Refund the customer — do not ship.";

async function refuseFulfilmentForStock(params: {
  db: OrderFulfillDb;
  orderId: string;
  paymentRef: string;
  gateway?: PaymentGateway;
  clientId: string;
  total: number;
  currency: string;
}): Promise<boolean> {
  return params.db.$transaction(async (tx) => {
    const flipped = await tx.order.updateMany({
      where: { id: params.orderId, paymentStatus: PaymentStatus.PENDING },
      data: {
        paymentStatus: PaymentStatus.PAID,
        paidAt: new Date(),
        paymentRef: params.paymentRef,
        status: OrderStatus.CANCELLED,
        adminNotes: STOCK_REFUSE_NOTE,
        ...(params.gateway ? { paymentGateway: params.gateway } : {}),
      },
    });

    if (flipped.count === 0) {
      return false;
    }

    await tx.payment.create({
      data: {
        reference: params.paymentRef,
        amount: params.total,
        currency: String(params.currency),
        method: gatewayToPaymentMethod(params.gateway ?? null),
        status: PaymentStatus.CONFIRMED,
        purpose: PaymentPurpose.RTW_ORDER,
        orderId: params.orderId,
        clientId: params.clientId,
        confirmedAt: new Date(),
      },
    });

    return true;
  }, INTERACTIVE_TX);
}

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

  let claimed = false;
  try {
    claimed = await db.$transaction(async (tx) => {
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
        if (!item.variantId) continue;
        const decremented = await tx.productVariant.updateMany({
          where: { id: item.variantId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (decremented.count === 0) {
          throw new InsufficientVariantStockError(item.variantId, item.quantity);
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
  } catch (err) {
    const isStock =
      err instanceof InsufficientVariantStockError ||
      (err instanceof Error && err.message === "INSUFFICIENT_VARIANT_STOCK");
    if (!isStock) {
      throw err;
    }

    const recorded = await refuseFulfilmentForStock({
      db,
      orderId: order.id,
      paymentRef: params.paymentRef,
      gateway: params.gateway,
      clientId,
      total: order.total,
      currency: String(order.currency),
    });

    if (recorded && params.notify !== false) {
      const clientEmail = order.guestEmail ?? order.user?.email;
      const clientName = order.guestName ?? order.user?.name ?? "Client";
      void createNotification({
        type: "PAYMENT_FAILED",
        title: "RTW oversell — refund required",
        message: `#${order.orderNumber} paid but stock was gone. Refund ${clientEmail ?? "the customer"} — do not ship. Queue: Orders → Refund required.`,
        link: `/admin/orders?attention=refund-required`,
        entityId: order.id,
      }).catch((e) => console.warn("[fulfillPaidOrder] oversell admin notify", e));

      if (clientEmail) {
        void sendRtwFulfilmentRefusedEmails({
          orderId: order.id,
          orderNumber: order.orderNumber,
          to: clientEmail,
          firstName: clientName.split(/\s+/)[0] ?? "Client",
          amountNGN: order.total,
        }).catch((e) => console.warn("[fulfillPaidOrder] oversell email", e));
      }
    }

    return true;
  }

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
