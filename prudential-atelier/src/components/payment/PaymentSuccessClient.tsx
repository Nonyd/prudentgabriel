"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

export function PaymentSuccessClient() {
  const searchParams = useSearchParams();
  const type = searchParams.get("type") ?? "order";
  const orderId = searchParams.get("orderId");
  const reference = searchParams.get("reference") ?? "";

  const [redirectIn, setRedirectIn] = useState(3);

  const target =
    type === "consultation"
      ? `/consultation/success?booking=${encodeURIComponent(reference)}`
      : type === "bespoke" && orderId
        ? `/account/orders`
        : "/account/orders";

  useEffect(() => {
    const t = setInterval(() => setRedirectIn((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (redirectIn > 0) return;
    window.location.href = target;
  }, [redirectIn, target]);

  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <div className="glass-2 glass-panel px-6 py-10">
      <CheckCircle2 className="mx-auto h-16 w-16 text-[var(--success)]" strokeWidth={1.25} />
      <h1 className="mt-6 font-display text-3xl text-[var(--chocolate)]">Payment successful</h1>
      <p className="mt-3 font-body text-sm text-[var(--text-mid)]">
        Thank you — your payment{reference ? ` (${reference})` : ""} was received.
      </p>
      <p className="mt-6 font-body text-xs text-[var(--text-light)]">
        Redirecting in {redirectIn}s…
      </p>
      <Link href={target} className="mt-4 inline-block font-body text-sm text-[var(--choc)] underline">
        Continue now
      </Link>
      </div>
    </div>
  );
}
