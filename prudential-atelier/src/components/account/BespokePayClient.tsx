"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import type { BespokeOrder } from "@prisma/client";
import { PaymentMethodSelector } from "@/components/checkout/PaymentMethodSelector";
import { StripePayBlock } from "@/components/checkout/StripePayBlock";
import type { PaymentCurrency, PaymentGatewayType } from "@/lib/payments/index";
import { convertFromNGN, formatPrice } from "@/lib/currency";
import { useCurrencyStore } from "@/store/currencyStore";
import { formatPrice as formatPriceUtil } from "@/lib/utils";

const MIN_PARTIAL = 10_000;

export function BespokePayClient({ order }: { order: BespokeOrder }) {
  const rates = useCurrencyStore((s) => s.rates);
  const setCurrency = useCurrencyStore((s) => s.setCurrency);
  const currency = useCurrencyStore((s) => s.currency) as PaymentCurrency;

  const [amountNGN, setAmountNGN] = useState(Math.round(order.balance));
  const [gateway, setGateway] = useState<PaymentGatewayType | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
  const [stripePk, setStripePk] = useState("");

  const displayAmount = useMemo(() => {
    if (currency === "NGN") return amountNGN;
    return convertFromNGN(amountNGN, currency, rates);
  }, [amountNGN, currency, rates]);

  const stripeReturnUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/api/bespoke/${order.id}/verify-payment?gateway=STRIPE`;
  }, [order.id]);

  async function pay() {
    if (!gateway) {
      toast.error("Choose a payment method");
      return;
    }
    if (amountNGN < MIN_PARTIAL && amountNGN < order.balance) {
      toast.error(`Minimum partial payment is ₦${MIN_PARTIAL.toLocaleString("en-NG")}`);
      return;
    }

    setBusy(true);
    try {
      if (gateway === "BANK_TRANSFER") {
        if (!receiptUrl) {
          toast.error("Upload your payment receipt");
          setBusy(false);
          return;
        }
        const res = await fetch(`/api/bespoke/${order.id}/bank-transfer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: amountNGN, receiptUrl }),
        });
        const data = (await res.json()) as { redirectUrl?: string; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Could not submit receipt");
        window.location.href = data.redirectUrl!;
        return;
      }

      const res = await fetch(`/api/bespoke/${order.id}/initialize-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amountNGN, currency, gateway }),
      });
      const data = (await res.json()) as {
        paymentUrl?: string;
        clientSecret?: string;
        publishableKey?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Could not start payment");

      if (gateway === "STRIPE" && data.clientSecret) {
        setStripeClientSecret(data.clientSecret);
        setStripePk(data.publishableKey ?? "");
        setBusy(false);
        return;
      }

      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
        return;
      }
      throw new Error("No payment URL returned");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payment failed");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/account/orders" className="font-body text-xs uppercase text-[var(--text-mid)] hover:underline">
        ← Back to orders
      </Link>
      <h1 className="mt-4 font-display text-3xl text-[var(--chocolate)]">Pay balance</h1>
      <p className="mt-1 font-body text-sm text-[var(--text-mid)]">{order.orderRef}</p>

      <div className="mt-8 border border-[var(--border)] bg-white p-6">
        <p className="font-body text-[11px] uppercase tracking-wide text-[var(--text-light)]">Order summary</p>
        <p className="mt-2 font-display text-lg text-[var(--chocolate)]">
          {order.outfitDescription?.slice(0, 120) ?? "Atelier commission"}
        </p>
        <dl className="mt-4 grid grid-cols-3 gap-3 font-body text-sm">
          <div>
            <dt className="text-[var(--text-light)]">Total</dt>
            <dd>{formatPriceUtil(order.totalAmount, "NGN")}</dd>
          </div>
          <div>
            <dt className="text-[var(--text-light)]">Paid</dt>
            <dd>{formatPriceUtil(order.amountPaid, "NGN")}</dd>
          </div>
          <div>
            <dt className="text-[var(--text-light)]">Balance</dt>
            <dd className="font-medium text-[var(--wine)]">{formatPriceUtil(order.balance, "NGN")}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-6 border border-[var(--border)] bg-white p-6">
        <label className="font-body text-[11px] uppercase tracking-wide text-[var(--text-light)]">
          Amount to pay (NGN)
        </label>
        <input
          type="number"
          min={order.balance <= MIN_PARTIAL ? order.balance : MIN_PARTIAL}
          max={Math.round(order.balance)}
          value={amountNGN}
          onChange={(e) => setAmountNGN(Number(e.target.value))}
          className="mt-2 w-full border border-[var(--border)] px-3 py-2 font-body text-sm"
        />
        <p className="mt-2 font-body text-xs text-[var(--text-mid)]">
          Minimum partial payment ₦{MIN_PARTIAL.toLocaleString("en-NG")}. You may pay the full balance.
        </p>

        <div className="mt-4 flex gap-2">
          {(["NGN", "USD", "GBP"] as PaymentCurrency[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCurrency(c)}
              className={`px-3 py-1 font-body text-[10px] uppercase tracking-wide ${
                currency === c ? "bg-[var(--wine)] text-white" : "border border-[var(--border)]"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <p className="mt-2 font-body text-sm text-[var(--chocolate)]">
          {formatPrice(displayAmount, currency)}
        </p>
      </div>

      <div className="mt-6 border border-[var(--border)] bg-white p-6">
        <PaymentMethodSelector
          currency={currency}
          amount={displayAmount}
          selected={gateway}
          onSelect={setGateway}
          receiptUrl={receiptUrl}
          onReceiptUploaded={setReceiptUrl}
        />

        {stripeClientSecret && stripePk ? (
          <StripePayBlock
            clientSecret={stripeClientSecret}
            publishableKey={stripePk}
            returnUrl={stripeReturnUrl}
          />
        ) : (
          <button
            type="button"
            disabled={busy || !gateway}
            onClick={() => void pay()}
            className="mt-6 w-full bg-[var(--wine)] py-3 font-body text-[11px] font-medium uppercase tracking-[0.12em] text-white disabled:opacity-50"
          >
            {busy ? "Processing…" : `Pay ${formatPrice(displayAmount, currency)}`}
          </button>
        )}
      </div>
    </div>
  );
}
