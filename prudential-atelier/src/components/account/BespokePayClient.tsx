"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { PaymentMethodSelector } from "@/components/checkout/PaymentMethodSelector";
import { StripePayBlock } from "@/components/checkout/StripePayBlock";
import type { PaymentCurrency, PaymentGatewayType } from "@/lib/payments/index";
import { convertAtLockedRate } from "@/lib/fx";
import { asShopPayCurrency, formatBespokeBook, lockedFxFromAtelier } from "@/lib/atelier-fx";
import { formatInvoiceCurrency } from "@/lib/invoice";
import type { InvoiceCurrency } from "@/types/invoice";
import { roundToKobo } from "@/lib/money";
import { currenciesWithMethods, defaultPayCurrency } from "@/lib/invoice-pay-options";

const MIN_PARTIAL = 10_000;

type PayOption = "deposit" | "full" | "custom";

export type BespokePayView = {
  id: string;
  orderRef: string;
  outfitDescription: string | null;
  totalAmount: number;
  amountPaid: number;
  balance: number;
  currency: string;
  fxRateLocked: number | null;
  fxGbpRateLocked: number | null;
  fxRateSource: string | null;
  fxRateFetchedAt: Date | string | null;
  fxRateStale: boolean;
  fxUsdAmountLocked: number | null;
  fxGbpAmountLocked: number | null;
  remainingDepositNGN: number;
  depositRequiredNGN: number;
};

function asFormatCur(c: PaymentCurrency): InvoiceCurrency {
  if (c === "USD" || c === "GBP") return c;
  return "NGN";
}

export function BespokePayClient({ order }: { order: BespokePayView }) {
  const fx = lockedFxFromAtelier(order);
  const shopCurrency = asShopPayCurrency(order.currency) as PaymentCurrency;
  const [payCurrency, setPayCurrency] = useState<PaymentCurrency>(shopCurrency);

  const remainingDeposit = order.remainingDepositNGN;
  const showDeposit = remainingDeposit > 0.01;
  const fullAmount = roundToKobo(order.balance);
  const [availableCurrencies, setAvailableCurrencies] = useState<PaymentCurrency[] | null>(null);

  const [payOption, setPayOption] = useState<PayOption>(showDeposit ? "deposit" : "full");
  const [customAmountNGN, setCustomAmountNGN] = useState(
    Math.min(fullAmount, Math.max(MIN_PARTIAL, showDeposit ? remainingDeposit : fullAmount)),
  );
  const [gateway, setGateway] = useState<PaymentGatewayType | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const paymentRef = useMemo(
    () => `PA-BESPOKE-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    [],
  );
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
  const [stripePk, setStripePk] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/payments/public-config?line=ATELIER")
      .then((r) => r.json())
      .then((data: { gateways?: Record<PaymentCurrency, PaymentGatewayType[]> }) => {
        if (cancelled) return;
        const available = currenciesWithMethods(data.gateways ?? { NGN: [], USD: [], GBP: [] });
        setAvailableCurrencies(available);
        const next = defaultPayCurrency(order.currency, available);
        if (next) setPayCurrency(next);
      })
      .catch(() => {
        if (!cancelled) setAvailableCurrencies(["NGN"]);
      });
    return () => {
      cancelled = true;
    };
  }, [order.currency]);

  const amountNGN = useMemo(() => {
    if (payOption === "deposit" && showDeposit) return remainingDeposit;
    if (payOption === "full") return fullAmount;
    return customAmountNGN;
  }, [customAmountNGN, fullAmount, payOption, remainingDeposit, showDeposit]);

  const displayAmount =
    payCurrency === "NGN" ? amountNGN : convertAtLockedRate(amountNGN, payCurrency, fx);

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
    if (amountNGN > order.balance) {
      toast.error("Amount cannot exceed your balance");
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
          body: JSON.stringify({ amount: amountNGN, receiptUrl, currency: payCurrency }),
        });
        const data = (await res.json()) as { redirectUrl?: string; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Could not submit receipt");
        window.location.href = data.redirectUrl!;
        return;
      }

      const res = await fetch(`/api/bespoke/${order.id}/initialize-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amountNGN, currency: payCurrency, gateway }),
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

  const money = (ngn: number) =>
    formatInvoiceCurrency(
      payCurrency === "NGN" ? ngn : convertAtLockedRate(ngn, payCurrency, fx),
      asFormatCur(payCurrency),
    );

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/account/orders" className="font-body text-xs uppercase text-[var(--text-mid)] hover:underline">
        ← Back to orders
      </Link>
      <h1 className="mt-4 font-display text-3xl text-[var(--chocolate)]">Pay balance</h1>
      <p className="mt-1 font-body text-sm text-[var(--text-mid)]">{order.orderRef}</p>

      <div className="mt-8 border border-[var(--border)] bg-bg-card p-6">
        <p className="font-body text-[11px] uppercase tracking-wide text-[var(--text-light)]">Order summary</p>
        <p className="mt-2 font-display text-lg text-[var(--chocolate)]">
          {order.outfitDescription?.slice(0, 120) ?? "Atelier commission"}
        </p>
        <dl className="mt-4 grid grid-cols-3 gap-3 font-body text-sm">
          <div>
            <dt className="text-[var(--text-light)]">Total</dt>
            <dd>{formatBespokeBook(order.totalAmount, order)}</dd>
          </div>
          <div>
            <dt className="text-[var(--text-light)]">Paid</dt>
            <dd>{formatBespokeBook(order.amountPaid, order)}</dd>
          </div>
          <div>
            <dt className="text-[var(--text-light)]">Balance</dt>
            <dd className="font-medium text-[var(--wine)]">{formatBespokeBook(order.balance, order)}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-6 border border-[var(--border)] bg-bg-card p-6">
        <p className="font-body text-[11px] uppercase tracking-wide text-[var(--text-light)]">
          How would you like to pay?
        </p>
        <div className="mt-4 space-y-3">
          {showDeposit ? (
            <label
              className={`block cursor-pointer rounded-sm border p-4 transition-colors ${
                payOption === "deposit"
                  ? "border-[1.5px] border-[var(--chocolate)] bg-[rgba(68,41,19,0.04)]"
                  : "border border-[var(--border)] bg-bg-card"
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="pay-option"
                  checked={payOption === "deposit"}
                  onChange={() => setPayOption("deposit")}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-body text-sm font-medium text-[var(--chocolate)]">Pay remaining deposit</p>
                  <p className="mt-1 font-display text-[28px] leading-none text-[var(--chocolate)]">
                    {money(remainingDeposit)}
                  </p>
                  <p className="mt-2 font-body text-[13px] text-[var(--text-mid)]">
                    The figure on your invoice, less anything already confirmed.
                  </p>
                </div>
              </div>
            </label>
          ) : null}

          <label
            className={`block cursor-pointer rounded-sm border p-4 transition-colors ${
              payOption === "full"
                ? "border-[1.5px] border-[var(--chocolate)] bg-[rgba(68,41,19,0.04)]"
                : "border border-[var(--border)] bg-bg-card"
            }`}
          >
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="pay-option"
                checked={payOption === "full"}
                onChange={() => setPayOption("full")}
                className="mt-1"
              />
              <div className="min-w-0 flex-1">
                <p className="font-body text-sm font-medium text-[var(--chocolate)]">Pay outstanding balance</p>
                <p className="mt-1 font-display text-[28px] leading-none text-[var(--chocolate)]">{money(fullAmount)}</p>
              </div>
            </div>
          </label>

          <label
            className={`block cursor-pointer rounded-sm border p-4 transition-colors ${
              payOption === "custom"
                ? "border-[1.5px] border-[var(--chocolate)] bg-[rgba(68,41,19,0.04)]"
                : "border border-[var(--border)] bg-bg-card"
            }`}
          >
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="pay-option"
                checked={payOption === "custom"}
                onChange={() => setPayOption("custom")}
                className="mt-1"
              />
              <div className="min-w-0 flex-1">
                <p className="font-body text-sm font-medium text-[var(--chocolate)]">Custom amount</p>
                <p className="mt-2 font-body text-[13px] text-[var(--text-mid)]">
                  Minimum partial payment ₦{MIN_PARTIAL.toLocaleString("en-NG")}.
                </p>
                {payOption === "custom" ? (
                  <input
                    type="number"
                    min={order.balance <= MIN_PARTIAL ? order.balance : MIN_PARTIAL}
                    max={Math.round(order.balance)}
                    value={customAmountNGN}
                    onChange={(e) => setCustomAmountNGN(Number(e.target.value))}
                    className="mt-3 w-full border border-[var(--border)] px-3 py-2 font-body text-sm"
                  />
                ) : null}
              </div>
            </div>
          </label>
        </div>

        <div className="mt-4 flex gap-2">
          {(availableCurrencies ?? [payCurrency]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setPayCurrency(c)}
              className={`px-3 py-1 font-body text-[10px] uppercase tracking-wide ${
                payCurrency === c ? "bg-[var(--wine)] text-white" : "border border-[var(--border)]"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <p className="mt-2 font-body text-sm text-[var(--chocolate)]">{money(amountNGN)}</p>
      </div>

      <div className="mt-6 border border-[var(--border)] bg-bg-card p-6">
        <PaymentMethodSelector
          currency={payCurrency}
          businessLine="ATELIER"
          amount={displayAmount}
          amountNGN={amountNGN}
          paymentReference={paymentRef}
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
            {busy ? "Processing…" : `Pay ${money(amountNGN)}`}
          </button>
        )}
      </div>
    </div>
  );
}
