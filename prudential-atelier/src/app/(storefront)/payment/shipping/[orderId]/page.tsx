import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Truck } from "lucide-react";
import { ShippingQuoteStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getBankTransferDetails } from "@/lib/payments/config";
import { BankTransferDetails } from "@/components/payment/BankTransferDetails";
import { ShippingPayButton } from "@/components/payment/ShippingPayButton";
import { ShippingReceiptUpload } from "@/components/payment/ShippingReceiptUpload";
import {
  findPendingShippingReceipt,
  findRejectedShippingReceipt,
  shippingAmountDueNGN,
  shippingDueLabel,
} from "@/lib/shipping/due";
import { verifyShippingPayCode } from "@/lib/shipping/pay-link";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pay shipping", robots: { index: false, follow: false } };

export default async function ShippingPayPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ c?: string; paid?: string; failed?: string }>;
}) {
  const { orderId } = await params;
  const sp = await searchParams;
  const code = sp.c ?? "";

  const order = verifyShippingPayCode(orderId, code)
    ? await prisma.order.findUnique({ where: { id: orderId } })
    : null;

  if (!order) {
    return (
      <Shell>
        <h1 className="font-display text-3xl text-[var(--chocolate)]">This link is not valid</h1>
        <p className="mt-3 font-body text-base leading-7 text-[var(--text-mid)]">
          Please open the link from your shipping email again, or sign in to see your orders.
        </p>
        <Link href="/account/orders" className="btn-primary mt-8 inline-flex">
          My orders
        </Link>
      </Shell>
    );
  }

  const dueNGN = shippingAmountDueNGN(order);
  const isPaid = dueNGN <= 0 && order.shippingQuoteStatus === ShippingQuoteStatus.PAID;

  if (dueNGN <= 0) {
    return (
      <Shell>
        <CheckCircle2 className="mx-auto h-14 w-14 text-[var(--gold)]" strokeWidth={1.25} />
        <h1 className="mt-6 font-display text-3xl text-[var(--chocolate)]">
          {isPaid ? "Shipping is paid" : "Nothing to pay"}
        </h1>
        <p className="mt-3 font-body text-base leading-7 text-[var(--text-mid)]">
          {isPaid
            ? `Thank you. Shipping for order #${order.orderNumber} is paid and we will send your piece on its way.`
            : `There is no shipping payment due on order #${order.orderNumber} right now.`}
        </p>
        <Link href="/account/orders" className="btn-primary mt-8 inline-flex">
          View my orders
        </Link>
      </Shell>
    );
  }

  const amountLabel = shippingDueLabel(order, dueNGN);
  const [bank, pendingReceipt, rejected] = await Promise.all([
    getBankTransferDetails("NGN", "RTW"),
    findPendingShippingReceipt(order.id),
    findRejectedShippingReceipt(order.id),
  ]);

  if (pendingReceipt) {
    return (
      <Shell>
        <CheckCircle2 className="mx-auto h-14 w-14 text-[var(--gold)]" strokeWidth={1.25} />
        <h1 className="mt-6 font-display text-3xl text-[var(--chocolate)]">We have your receipt</h1>
        <p className="mt-3 font-body text-base leading-7 text-[var(--text-mid)]">
          Thank you. We are checking your transfer of {amountLabel} for order #{order.orderNumber} against our account.
          We will email you as soon as it is confirmed, usually within a few hours on business days.
        </p>
        <Link href="/account/orders" className="btn-primary mt-8 inline-flex">
          View my orders
        </Link>
      </Shell>
    );
  }
  const includesPiece = order.paymentStatus !== "PAID";

  return (
    <Shell>
      <Truck className="mx-auto h-12 w-12 text-[var(--gold)]" strokeWidth={1.25} />
      <h1 className="mt-6 font-display text-3xl text-[var(--chocolate)]">Pay for shipping</h1>
      <p className="mt-2 font-body text-sm text-[var(--text-mid)]">Order #{order.orderNumber}</p>

      {rejected ? (
        <p className="mt-6 border border-red-200 bg-red-50 px-4 py-3 text-left font-body text-sm text-red-800">
          We could not confirm the last receipt you sent
          {rejected.rejectedReason ? `: ${rejected.rejectedReason}` : "."} Please pay below or upload the right
          receipt.
        </p>
      ) : null}

      {sp.failed ? (
        <p className="mt-6 border border-red-200 bg-red-50 px-4 py-3 text-left font-body text-sm text-red-800">
          The payment did not go through. You have not been charged; please try again.
        </p>
      ) : null}

      <div className="mt-8 glass-opaque p-6 text-left">
        <p className="text-[11px] uppercase tracking-wide text-[var(--text-light)]">
          {includesPiece ? "Amount due (your piece and shipping)" : "Shipping amount due"}
        </p>
        <p className="mt-1 font-display text-3xl text-[var(--chocolate)]">{amountLabel}</p>
        {order.carrier ? (
          <p className="mt-3 font-body text-sm text-[var(--text-mid)]">Carrier: {order.carrier}</p>
        ) : null}
        {order.shippingQuoteNote ? (
          <p className="mt-1 whitespace-pre-line font-body text-sm text-[var(--text-mid)]">{order.shippingQuoteNote}</p>
        ) : null}
        <div className="mt-6">
          <ShippingPayButton orderId={order.id} code={code} />
        </div>
        <p className="mt-3 font-body text-xs text-[var(--text-light)]">
          Card, bank transfer or USSD through Paystack. You can come back to this page any time.
        </p>
      </div>

      {bank ? (
        <div className="mt-6 glass-opaque p-6 text-left">
          <p className="text-[11px] uppercase tracking-wide text-[var(--text-light)]">Or pay by direct transfer</p>
          <div className="mt-2">
            <BankTransferDetails bank={bank} paymentReference={order.orderNumber} />
          </div>
          <p className="mt-3 font-body text-xs text-[var(--text-mid)]">
            Use your order number <strong>{order.orderNumber}</strong> as the transfer narration, then upload the
            receipt below so we can confirm it.
          </p>
          <ShippingReceiptUpload orderId={order.id} code={code} />
        </div>
      ) : null}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-lg px-4 py-20 text-center">{children}</div>
    </div>
  );
}
