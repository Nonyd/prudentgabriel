import { prisma } from "@/lib/prisma";
import { sendShippingQuoteEmail } from "@/lib/email";
import { getBankTransferDetails } from "@/lib/payments/config";
import { createClientNotification } from "@/lib/customer-notifications";
import { shippingAmountDueNGN, shippingDueLabel } from "@/lib/shipping/due";
import { shippingPayPath, shippingPayUrl } from "@/lib/shipping/pay-link";

type Locked = { quotedAt?: string | null; amountNGN?: number | null } & Record<string, unknown>;

/** Changes with every saved quote, so a corrected quote is emailed again. */
export function shippingQuoteKey(locked: unknown, amountNGN: number): string {
  const at = (locked as Locked | null)?.quotedAt;
  const t = at ? Date.parse(at) : NaN;
  return `${Number.isFinite(t) ? t.toString(36) : "q"}-${Math.round(amountNGN)}`;
}

/**
 * Email her the shipping amount with the lasting Paystack pay link, and put the
 * same in her notification bell when she has an account.
 * Returns false when there is nothing to pay or no email to send to.
 */
export async function sendShippingPaymentRequest(
  orderId: string,
  opts: { reminder?: { count: number } } = {},
): Promise<boolean> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: { select: { email: true, name: true } } },
  });
  if (!order) return false;
  const dueNGN = shippingAmountDueNGN(order);
  if (dueNGN <= 0) return false;

  const email = (order.guestEmail ?? order.user?.email ?? "").trim();
  if (!email) return false;

  const name = (order.guestName ?? order.user?.name ?? "").trim();
  const firstName = name.split(/\s+/)[0] || "there";
  const amountLabel = shippingDueLabel(order, dueNGN);
  const bank = await getBankTransferDetails("NGN", "RTW");

  await sendShippingQuoteEmail({
    to: email,
    firstName,
    orderNumber: order.orderNumber,
    amountLabel,
    carrier: order.carrier,
    note: order.shippingQuoteNote,
    bank: bank ?? { bankName: "", accountNumber: "", accountName: "" },
    payUrl: shippingPayUrl(order.id),
    quoteKey: shippingQuoteKey(order.shippingQuoteLocked, order.shippingAmount),
    reminder: opts.reminder,
  });

  if (order.userId) {
    await createClientNotification({
      userId: order.userId,
      type: "BALANCE_REMINDER",
      title: opts.reminder ? "Shipping still unpaid" : "Shipping payment due",
      message: `Order #${order.orderNumber}: ${amountLabel} to pay for shipping.`,
      link: shippingPayPath(order.id),
      entityId: order.id,
    }).catch((e) => console.warn("[shipping] notify", e));
  }
  return true;
}
