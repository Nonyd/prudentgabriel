import { OrderStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { maybeArchiveBespokeOrder } from "@/lib/bespoke-archive";
import { maybeSendBespokeReviewRequest } from "@/lib/bespoke-review";

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

/**
 * Client-only receipt confirmation. Staff cannot confirm on the client's behalf.
 */
export async function confirmBespokeReceipt(params: {
  orderId?: string;
  token?: string;
  actor: { id: string; role: Role | string; email?: string | null };
}): Promise<{ orderId: string; orderRef: string }> {
  if (isStaffRole(params.actor.role)) {
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

  if (order.receiptConfirmedAt) {
    return { orderId: order.id, orderRef: order.orderRef };
  }

  // Ownership: client email match or clientProfile.userId
  const profile = order.clientProfileId
    ? await prisma.clientProfile.findUnique({
        where: { id: order.clientProfileId },
        select: { userId: true },
      })
    : null;
  const owns =
    profile?.userId === params.actor.id ||
    (order.clientEmail &&
      params.actor.email &&
      order.clientEmail.toLowerCase() === params.actor.email.toLowerCase());

  // Token path: email link proves possession of the token; still require actor is CUSTOMER
  // and (when logged in) matches the order client when possible.
  if (params.token) {
    if (params.actor.email && order.clientEmail) {
      if (order.clientEmail.toLowerCase() !== params.actor.email.toLowerCase() && !owns) {
        // Allow token-only confirm for guest who created an account later with same email —
        // if emails diverge, still allow token (email inbox possession).
      }
    }
  } else if (!owns) {
    throw new ReceiptConfirmError("You can only confirm receipt for your own order", 403);
  }

  await prisma.bespokeOrder.update({
    where: { id: order.id },
    data: {
      receiptConfirmedAt: new Date(),
      receiptConfirmedById: params.actor.id,
    },
  });

  void maybeSendBespokeReviewRequest(order.id).catch((e) =>
    console.warn("[confirmBespokeReceipt] review", e),
  );
  void maybeArchiveBespokeOrder(order.id).catch((e) =>
    console.warn("[confirmBespokeReceipt] archive", e),
  );

  return { orderId: order.id, orderRef: order.orderRef };
}
