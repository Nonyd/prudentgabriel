import {
  OrderStatus,
  PaymentGateway,
  PaymentPurpose,
  PaymentStatus,
  type PrismaClient,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { INTERACTIVE_TX } from "@/lib/prisma-tx";
import { awardPurchasePoints, pointsPaymentData, returnRedeemedPoints } from "@/lib/points";
import { autoOnboardClient } from "@/lib/client-onboarding";
import { sendOrderConfirmationEmail, sendRtwFulfilmentRefusedEmails } from "@/lib/email";
import { notifyOrderConfirmed, notifyPaymentConfirmed } from "@/lib/customer-notifications";
import { createNotification } from "@/lib/notifications";
import { getPublicAppUrl } from "@/lib/app-url";
import { appendPayment, gatewayToPaymentMethod, resolveClientId } from "@/lib/payments/ledger";
import { markCheckoutSessionsRecovered } from "@/lib/checkout-session";
import { recomputeRtwOrderTotals, rtwHasOutstandingBalance } from "@/lib/payments/rtw-totals";
import { commitCouponUsage, releaseCouponUsage } from "@/lib/coupon";
import { getShippingCopy } from "@/lib/shipping/copy";
import { countryIsNigeria } from "@/lib/shipping/destination";
import {
  CUSTOM_RETURNS_COPY,
  formatSnapshotLines,
  parseSnapshot,
  shouldDecrementStock,
} from "@/lib/custom-size";
import { syncProfileFromSnapshots } from "@/lib/custom-order-line";
import {
  applySale,
  afterStockWrites,
  FULFILMENT_STOCK_REFUSE_NOTE,
  InsufficientVariantStockError,
  type StockWriteResult,
} from "@/lib/stock-ledger";

export type OrderFulfillDb = Pick<PrismaClient, "$transaction" | "order">;

export { InsufficientVariantStockError, FULFILMENT_STOCK_REFUSE_NOTE };

async function confirmedOnOrder(tx: object, orderId: string): Promise<number> {
  const payment = (tx as {
    payment?: { aggregate?: (args: Record<string, unknown>) => Promise<{ _sum?: { amount?: unknown } | null }> };
  }).payment;
  if (typeof payment?.aggregate !== "function") return 0;
  const agg = await payment.aggregate({
    where: { orderId, status: PaymentStatus.CONFIRMED },
    _sum: { amount: true },
  });
  return Number(agg._sum?.amount ?? 0);
}

async function refuseFulfilmentForStock(params: {
  db: OrderFulfillDb;
  orderId: string;
  paymentRef: string;
  gateway?: PaymentGateway;
  clientId: string;
  total: number;
  currency: string;
  pointsDiscountNGN?: number;
}): Promise<boolean> {
  const recorded = await params.db.$transaction(async (tx) => {
    const already = await confirmedOnOrder(tx, params.orderId);
    const pointsHold = already > 0.01 ? 0 : (params.pointsDiscountNGN ?? 0);
    const remaining = Math.max(0, Math.round((params.total - already - pointsHold) * 100) / 100);
    const pointsOnly = remaining <= 0.01;

    const flipped = await tx.order.updateMany({
      where: { id: params.orderId, paymentStatus: PaymentStatus.PENDING },
      data: {
        paymentStatus: pointsOnly ? PaymentStatus.REFUNDED : PaymentStatus.PAID,
        paidAt: pointsOnly ? undefined : new Date(),
        paymentRef: params.paymentRef,
        status: OrderStatus.CANCELLED,
        adminNotes: FULFILMENT_STOCK_REFUSE_NOTE,
        ...(params.gateway ? { paymentGateway: params.gateway } : {}),
      },
    });

    if (flipped.count === 0) {
      return false;
    }

    if (remaining > 0.01) {
      await tx.payment.create({
        data: {
          reference: params.paymentRef,
          amount: remaining,
          currency: String(params.currency),
          method: gatewayToPaymentMethod(params.gateway ?? null),
          status: PaymentStatus.CONFIRMED,
          purpose: PaymentPurpose.RTW_ORDER,
          orderId: params.orderId,
          clientId: params.clientId,
          confirmedAt: new Date(),
        },
      });
    }

    if ("pointsTransaction" in tx) {
      await returnRedeemedPoints(params.orderId, tx);
    }
    return true;
  }, INTERACTIVE_TX);

  return recorded;
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
      items: { include: { product: { select: { name: true, slug: true } } } },
      user: { select: { id: true, email: true, name: true } },
    },
  });

  if (!order) return false;

  if (order.paymentStatus === PaymentStatus.PAID && rtwHasOutstandingBalance(order)) {
    const existing = await prisma.payment.findUnique({ where: { reference: params.paymentRef } });
    if (existing) return true;
    const clientId =
      params.clientId ??
      (await resolveClientId({
        userId: order.userId,
        email: order.guestEmail ?? order.user?.email,
      }));
    await appendPayment({
      reference: params.paymentRef,
      amount: order.balance,
      currency: String(order.currency),
      method: gatewayToPaymentMethod(params.gateway ?? null),
      status: PaymentStatus.CONFIRMED,
      purpose: PaymentPurpose.BALANCE,
      orderId: order.id,
      clientId,
      confirmedAt: new Date(),
    });
    return true;
  }

  if (order.paymentStatus === PaymentStatus.PAID) {
    const paidEmail = order.guestEmail ?? order.user?.email;
    if (paidEmail) {
      void markCheckoutSessionsRecovered({
        email: paidEmail,
        orderId: order.id,
        lines: order.items.map((i) => ({ productId: i.productId, variantId: i.variantId })),
      }).catch((e) => console.warn("[fulfillPaidOrder] checkout recover", e));
    }
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
  let stockWrites: StockWriteResult[] = [];
  try {
    const outcome = await db.$transaction(async (tx) => {
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
        return { claimed: false, writes: [] as StockWriteResult[] };
      }

      const writes: StockWriteResult[] = [];
      for (const item of order.items) {
        if (!item.variantId) continue;
        if (!shouldDecrementStock(item.sizeMode)) continue;
        writes.push(
          await applySale(tx, {
            variantId: item.variantId,
            quantity: item.quantity,
            orderId: order.id,
          }),
        );
      }

      if (order.pointsUsed > 0 && order.pointsDiscountNGN > 0.01 && "payment" in tx) {
        const payment = (
          tx as unknown as {
            payment?: {
              findFirst?: (args: Record<string, unknown>) => Promise<{ id: string } | null>;
              create?: (args: { data: Record<string, unknown> }) => Promise<unknown>;
            };
          }
        ).payment;
        const existing =
          typeof payment?.findFirst === "function"
            ? await payment.findFirst({
                where: { orderId: order.id, purpose: PaymentPurpose.POINTS_REDEMPTION },
                select: { id: true },
              })
            : null;
        if (!existing && typeof payment?.create === "function") {
          await payment.create({
            data: pointsPaymentData({
              orderId: order.id,
              orderNumber: order.orderNumber,
              amountNGN: order.pointsDiscountNGN,
              clientId,
            }),
          });
        }
      }

      const already = await confirmedOnOrder(tx, order.id);
      const remaining = Math.max(0, Math.round((order.total - already) * 100) / 100);
      if (remaining > 0.01) {
        await tx.payment.create({
          data: {
            reference: params.paymentRef,
            amount: remaining,
            currency: String(order.currency),
            method: gatewayToPaymentMethod(params.gateway ?? null),
            status: PaymentStatus.CONFIRMED,
            purpose: PaymentPurpose.RTW_ORDER,
            orderId: order.id,
            clientId,
            confirmedAt: new Date(),
          },
        });
      }

      return { claimed: true, writes };
    }, INTERACTIVE_TX);
    claimed = outcome.claimed;
    stockWrites = outcome.writes;
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
      pointsDiscountNGN: order.pointsDiscountNGN,
    });

    if (recorded && !params.db) {
      if (order.pointsDiscountNGN > 0.01 && order.pointsDiscountNGN >= order.total - 0.01) {
        await releaseCouponUsage(prisma, order.id);
      } else {
        await commitCouponUsage(prisma, order.id);
        if (order.userId) {
          await prisma.cartItem.deleteMany({ where: { userId: order.userId } });
        }
      }
    }

    if (recorded && params.notify !== false) {
      const clientEmail = order.guestEmail ?? order.user?.email;
      const clientName = order.guestName ?? order.user?.name ?? "Client";
      void createNotification({
        type: "RTW_OVERSELL",
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

  if (!params.db) {
    await commitCouponUsage(prisma, order.id);
    if (order.userId) {
      await prisma.cartItem.deleteMany({ where: { userId: order.userId } });
    }
    await recomputeRtwOrderTotals(order.id).catch((e) => console.warn("[fulfillPaidOrder] rtw totals", e));
  }

  if (stockWrites.length) {
    await afterStockWrites(stockWrites).catch((e) => console.warn("[fulfillPaidOrder] stock after", e));
  }

  if (params.notify === false) {
    return true;
  }

  let userId = order.userId;
  const clientEmail = order.guestEmail ?? order.user?.email;
  const clientName = order.guestName ?? order.user?.name ?? "Client";
  let pointsEarned = 0;

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
    const snaps = order.items.flatMap((i) => parseSnapshot(i.measurements));
    if (snaps.length) {
      void syncProfileFromSnapshots(userId, snaps).catch((e) =>
        console.warn("[fulfillPaidOrder] measurement profile", e),
      );
    }
    pointsEarned = await awardPurchasePoints(
      userId,
      Math.max(0, order.subtotal - order.discount),
      order.id,
      undefined,
      order.pointsDiscountNGN,
    ).catch((e) => {
      console.warn("[fulfillPaidOrder] points", e);
      return 0;
    });
  }

  const emailTo = clientEmail;
  if (emailTo) {
    void markCheckoutSessionsRecovered({
      email: emailTo,
      orderId: order.id,
      lines: order.items.map((i) => ({ productId: i.productId, variantId: i.variantId })),
    }).catch((e) => console.warn("[fulfillPaidOrder] checkout recover", e));

    const snap = order.addressSnapshot as Record<string, string> | null;
    const international = snap?.country ? !countryIsNigeria(snap.country) : false;
    void getShippingCopy()
      .then((copy) =>
        sendOrderConfirmationEmail({
          to: emailTo,
          firstName: snap?.firstName ?? clientName.split(/\s+/)[0] ?? "Client",
          orderNumber: order.orderNumber,
          items: order.items.map((i) => {
            const snap = parseSnapshot(i.measurements);
            return {
              name: i.product.name,
              size: i.size ?? "",
              color: i.color ?? "",
              qty: i.quantity,
              priceNGN: i.price,
              custom: i.sizeMode === "CUSTOM",
              measurements: snap.length ? formatSnapshotLines(snap) : undefined,
            };
          }),
          subtotalNGN: order.subtotal,
          totalNGN: order.total,
          shippingNGN: order.shippingAmount,
          discountNGN: order.discount,
          pointsDiscNGN: order.pointsDiscountNGN,
          pointsEarned,
          addressSnapshot: snap ?? undefined,
          dduDisclosure: international ? copy.dduDisclosure : undefined,
          quotePending: order.shippingQuoteStatus === "QUOTE_PENDING",
          quotePendingText: order.shippingConsentText ?? undefined,
          customLeadDays: order.customLeadTimeDays,
          customReturnNote: order.customReturnable === false ? CUSTOM_RETURNS_COPY : null,
        }),
      )
      .catch((e) => console.warn("[fulfillPaidOrder] email", e));
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
