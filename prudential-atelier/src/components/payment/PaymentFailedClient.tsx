"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { XCircle } from "lucide-react";

export function PaymentFailedClient() {
  const searchParams = useSearchParams();
  const type = searchParams.get("type") ?? "order";
  const orderId = searchParams.get("orderId");
  const reference = searchParams.get("reference") ?? "";

  const retryHref =
    type === "bespoke" && orderId
      ? `/account/orders/bespoke/${orderId}/pay`
      : type === "consultation"
        ? "/consultation"
        : "/checkout";

  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <XCircle className="mx-auto h-16 w-16 text-[var(--wine)]" strokeWidth={1.25} />
      <h1 className="mt-6 font-display text-3xl text-[var(--chocolate)]">Payment not completed</h1>
      <p className="mt-3 font-body text-sm text-[var(--text-mid)]">
        Your payment{reference ? ` (${reference})` : ""} was not completed. Your order is still pending — you can try
        again or pay by bank transfer.
      </p>
      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link
          href={retryHref}
          className="inline-block bg-[var(--wine)] px-6 py-3 font-body text-[11px] uppercase tracking-wide text-white"
        >
          Try again
        </Link>
        <Link
          href={retryHref}
          className="inline-block border border-[var(--border)] px-6 py-3 font-body text-[11px] uppercase tracking-wide text-[var(--chocolate)]"
        >
          Pay by bank transfer
        </Link>
      </div>
    </div>
  );
}
