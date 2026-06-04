"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Clock3 } from "lucide-react";

export function PaymentPendingClient() {
  const searchParams = useSearchParams();
  const reference = searchParams.get("reference") ?? "";
  const type = searchParams.get("type") ?? "order";
  const orderId = searchParams.get("orderId");
  const [bank, setBank] = useState({ bankName: "", accountNumber: "", accountName: "" });

  useEffect(() => {
    void fetch("/api/payments/public-config")
      .then((r) => r.json())
      .then((data: { bank?: { bankName: string; accountNumber: string; accountName: string } }) => {
        if (data.bank) setBank(data.bank);
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className="mx-auto max-w-lg px-4 py-20">
      <div className="text-center">
        <Clock3 className="mx-auto h-14 w-14 text-[var(--gold)]" strokeWidth={1.25} />
        <h1 className="mt-6 font-display text-3xl text-[var(--chocolate)]">Payment pending</h1>
        <p className="mt-3 font-body text-sm text-[var(--text-mid)]">
          We received your bank transfer details{reference ? ` for ${reference}` : ""}. Confirmation usually takes
          2–4 hours on business days.
        </p>
      </div>

      <div className="mt-8 border border-[var(--border)] bg-white p-5 font-body text-sm">
        <p className="text-[11px] uppercase tracking-wide text-[var(--text-light)]">Bank details</p>
        <p className="mt-2">{bank.bankName || "—"}</p>
        <p className="font-medium">{bank.accountNumber || "—"}</p>
        <p>{bank.accountName || "—"}</p>
      </div>

      {type === "bespoke" && orderId ? (
        <p className="mt-6 text-center">
          <Link
            href={`/account/orders/bespoke/${orderId}/pay`}
            className="font-body text-sm text-[var(--wine)] underline"
          >
            Return to payment page to upload receipt
          </Link>
        </p>
      ) : null}

      <div className="mt-8 text-center">
        <Link href="/account/orders" className="font-body text-sm text-[var(--wine)] underline">
          View my orders
        </Link>
      </div>
    </div>
  );
}
