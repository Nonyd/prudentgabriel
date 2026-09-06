import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getBespokeOrderForUser } from "@/lib/bespoke-order-access";
import { BespokePayClient } from "@/components/account/BespokePayClient";
import { getBespokeDepositPercent } from "@/lib/payments/ledger";

export default async function BespokePayPage({ params }: { params: Promise<{ orderId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/account/orders");

  const { orderId } = await params;
  const order = await getBespokeOrderForUser(orderId, session.user.id);
  if (!order) notFound();
  if (order.balance <= 0) redirect("/account/orders");

  const depositPercent = await getBespokeDepositPercent();

  return (
    <div>
      <BespokePayClient order={order} depositPercent={depositPercent} />
    </div>
  );
}
