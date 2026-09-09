import { OrderStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { maybeSendBespokeReviewRequest } from "@/lib/bespoke-review";
import { actorOwnsBespokeOrder } from "@/lib/public-pii-dtos";
import {
  alterationWindowClosesAt,
  getAlterationWarrantyDays,
} from "@/lib/alterations/policy";

export class ReceiptConfirmError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ReceiptConfirmError";
  }
}

function isStaffRole(role: Role | string | null | undefined): boolean {
  if (!role) return false;
  return role !== Role.CUSTOMER;
}

export type ReceiptConfirmResult = {
  orderId: string;
  orderRef: string;
  warrantyEndsAt: string;
};

/**
 * Confirm receipt. The public token path needs no session. The account path
 * still requires the client. Confirming does not archive — it opens the
 * alteration window.
 */
export async function confirmBespokeReceipt(params: {
  orderId?: string;
  token?: string;
  actor?: { id: string; role: Role | string; email?: string | null } | null;
}): Promise<ReceiptConfirmResult> {
  if (!params.token && params.actor && isStaffRole(params.actor.role)) {
    throw new ReceiptConfirmError("Only the client can confirm receipt", 403);
  }

  const order = params.token
    ? await prisma.bespokeOrder.findUnique({ where: { receiptConfirmToken: params.token } })
    : params.orderId
      ? await prisma.bespokeOrder.findUnique({ where: { id: params.orderId } })
      : null;

  if (!order) throw new ReceiptConfirmError("Order not found", 404);

  if (order.status === OrderStatus.ARCHIVED) {
    throw new ReceiptConfirmError("This order is archived", 400);
  }

  if (order.status !== OrderStatus.DELIVERED && !order.deliveredAt) {
    throw new ReceiptConfirmError("Receipt can only be confirmed after delivery", 400);
  }

  const warrantyDays = await getAlterationWarrantyDays();

  if (order.receiptConfirmedAt) {
    return {
      orderId: order.id,
      orderRef: order.orderRef,
      warrantyEndsAt: alterationWindowClosesAt(order.receiptConfirmedAt, warrantyDays).toISOString(),
    };
  }

  if (!params.token) {
    if (!params.actor?.id) {
      throw new ReceiptConfirmError("Please sign in to confirm receipt", 401);
    }
    const profile = order.clientProfileId
      ? await prisma.clientProfile.findUnique({
          where: { id: order.clientProfileId },
          select: { userId: true },
        })
      : null;
    const owns = actorOwnsBespokeOrder({
      actorId: params.actor.id,
      actorEmail: params.actor.email,
      clientEmail: order.clientEmail,
      profileUserId: profile?.userId,
    });
    if (!owns) {
      throw new ReceiptConfirmError("Unable to confirm receipt", 403);
    }
  }

  const confirmedAt = new Date();
  const actorId =
    params.actor && !isStaffRole(params.actor.role) ? params.actor.id : null;

  await prisma.bespokeOrder.update({
    where: { id: order.id },
    data: {
      receiptConfirmedAt: confirmedAt,
      receiptConfirmedById: actorId,
    },
  });

  void maybeSendBespokeReviewRequest(order.id).catch((e) =>
    console.warn("[confirmBespokeReceipt] review", e),
  );

  return {
    orderId: order.id,
    orderRef: order.orderRef,
    warrantyEndsAt: alterationWindowClosesAt(confirmedAt, warrantyDays).toISOString(),
  };
}
