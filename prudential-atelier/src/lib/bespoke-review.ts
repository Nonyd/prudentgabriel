import { prisma } from "@/lib/prisma";
import { sendBespokeReviewRequestEmail } from "@/lib/email";
import { notifyReviewRequest } from "@/lib/customer-notifications";
import { getPublicAppUrl } from "@/lib/app-url";

/** Send bespoke review request once. Returns true if sent (or already marked sent). */
export async function maybeSendBespokeReviewRequest(orderId: string): Promise<boolean> {
  const order = await prisma.bespokeOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderRef: true,
      clientName: true,
      clientEmail: true,
      clientProfileId: true,
      reviewRequestSent: true,
      receiptConfirmedAt: true,
      deliveredAt: true,
    },
  });
  if (!order) return false;
  if (order.reviewRequestSent) return true;
  if (!order.receiptConfirmedAt && !order.deliveredAt) return false;

  const firstName = order.clientName.split(/\s+/)[0] ?? order.clientName;
  const reviewUrl = `${getPublicAppUrl().replace(/\/+$/, "")}/account/orders/bespoke/${order.id}`;

  await sendBespokeReviewRequestEmail({
    to: order.clientEmail,
    firstName,
    orderRef: order.orderRef,
    reviewUrl,
  });

  await prisma.bespokeOrder.update({
    where: { id: order.id },
    data: { reviewRequestSent: true },
  });

  let userId: string | null = null;
  if (order.clientProfileId) {
    const profile = await prisma.clientProfile.findUnique({
      where: { id: order.clientProfileId },
      select: { userId: true },
    });
    userId = profile?.userId ?? null;
  }
  if (!userId) {
    const user = await prisma.user.findUnique({
      where: { email: order.clientEmail.toLowerCase() },
      select: { id: true },
    });
    userId = user?.id ?? null;
  }
  if (userId) {
    notifyReviewRequest({
      userId,
      orderId: order.id,
      productName: order.orderRef,
    });
  }

  return true;
}
