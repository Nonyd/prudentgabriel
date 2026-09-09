import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getBespokeOrderForUser } from "@/lib/bespoke-order-access";
import { BespokePayClient } from "@/components/account/BespokePayClient";
import { remainingDepositNGN } from "@/lib/atelier-fx";
import { getOrderPaymentSummary, toNumber } from "@/lib/payments/ledger";

export default async function BespokePayPage({ params }: { params: Promise<{ orderId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/account/orders");

  const { orderId } = await params;
  const order = await getBespokeOrderForUser(orderId, session.user.id);
  if (!order) notFound();
  if (order.balance <= 0) redirect("/account/orders");

  const summary = await getOrderPaymentSummary(order.id);

  return (
    <div>
      <BespokePayClient
        order={{
          id: order.id,
          orderRef: order.orderRef,
          outfitDescription: order.outfitDescription,
          totalAmount: order.totalAmount,
          amountPaid: order.amountPaid,
          balance: order.balance,
          currency: order.currency,
          fxRateLocked: order.fxRateLocked,
          fxGbpRateLocked: order.fxGbpRateLocked,
          fxRateSource: order.fxRateSource,
          fxRateFetchedAt: order.fxRateFetchedAt,
          fxRateStale: order.fxRateStale,
          fxUsdAmountLocked: order.fxUsdAmountLocked,
          fxGbpAmountLocked: order.fxGbpAmountLocked,
          remainingDepositNGN: remainingDepositNGN({
            depositRequiredNGN: toNumber(summary.depositRequired),
            confirmedNGN: toNumber(summary.confirmed),
          }),
          depositRequiredNGN: toNumber(summary.depositRequired),
        }}
      />
    </div>
  );
}
