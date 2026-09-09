"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { PaymentMethodSelector } from "@/components/checkout/PaymentMethodSelector";
import { StripePayBlock } from "@/components/checkout/StripePayBlock";
import type { PaymentCurrency, PaymentGatewayType } from "@/lib/payments/index";
import { convertAtLockedRate } from "@/lib/fx";
import { formatInvoiceCurrency } from "@/lib/invoice";
import type { InvoiceCurrency } from "@/types/invoice";
import { asShopPayCurrency, lockedFxFromAtelier } from "@/lib/atelier-fx";
import type { PublicInvoicePayState } from "@/lib/public-invoice-payload";

type PayOption = "deposit" | "full";

function asFormatCur(c: PaymentCurrency): InvoiceCurrency {
  if (c === "USD" || c === "GBP") return c;
  return "NGN";
}

export function PublicInvoicePayClient({
  token,
  pay,
  currency,
}: {
  token: string;
  pay: PublicInvoicePayState;
  currency: string;
}) {
  const remainingDeposit = pay.remainingDepositNGN;
  const showDeposit = remainingDeposit > 0.01;
  const [payOption, setPayOption] = useState<PayOption>(showDeposit ? "deposit" : "full");
  const [gateway, setGateway] = useState<PaymentGatewayType | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
  const [stripePk, setStripePk] = useState("");
  const shopCurrency = asShopPayCurrency(currency) as PaymentCurrency;
  const [payCurrency, setPayCurrency] = useState<PaymentCurrency>(shopCurrency);
  const fx = lockedFxFromAtelier({
    fxRateLocked: pay.fxRateLocked,
    fxGbpRateLocked: pay.fxGbpRateLocked,
  });

  const amountNGN = payOption === "deposit" && showDeposit ? remainingDeposit : pay.remainingBalanceNGN;
  const displayAmount =
    payCurrency === "NGN" ? amountNGN : convertAtLockedRate(amountNGN, payCurrency, fx);

  const paymentRef = useMemo(
    () => `PA-INV-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    [],
  );

  if (!pay.canPay) return null;

  async function submit() {
    if (!gateway) {
      toast.error("Choose a payment method");
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
        const res = await fetch(`/api/invoice/${token}/bank-transfer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: payOption === "deposit" && showDeposit ? "deposit" : "full",
            receiptUrl,
            currency: payCurrency,
          }),
        });
        const data = (await res.json()) as { redirectUrl?: string; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Could not submit receipt");
        window.location.href = data.redirectUrl!;
        return;
      }

      const res = await fetch(`/api/invoice/${token}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: payOption === "deposit" && showDeposit ? "deposit" : "full",
          currency: payCurrency,
          gateway,
        }),
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
    <div className="mt-10 border border-[#EBEBEA] bg-[#FAFAF8] p-5">
      <p className="font-body text-[10px] font-medium uppercase tracking-[0.12em] text-[#6B6B68]">
        Pay this invoice
      </p>
      <p className="mt-2 font-body text-sm text-ink">
        {pay.pieceLabel}
        {pay.orderRef ? ` · ${pay.orderRef}` : ""}
      </p>
      <div className="mt-4 space-y-2">
        {showDeposit ? (
          <label className="flex cursor-pointer items-start gap-3 rounded-sm border border-[#EBEBEA] bg-white p-3">
            <input
              type="radio"
              name="inv-pay"
              checked={payOption === "deposit"}
              onChange={() => setPayOption("deposit")}
              className="mt-1"
            />
            <span>
              <span className="block font-body text-sm font-medium">Pay remaining deposit</span>
              <span className="font-display text-xl text-ink">
                {formatInvoiceCurrency(
                  payCurrency === "NGN"
                    ? remainingDeposit
                    : convertAtLockedRate(remainingDeposit, payCurrency, fx),
                  asFormatCur(payCurrency),
                )}
              </span>
            </span>
          </label>
        ) : null}
        <label className="flex cursor-pointer items-start gap-3 rounded-sm border border-[#EBEBEA] bg-white p-3">
          <input
            type="radio"
            name="inv-pay"
            checked={payOption === "full"}
            onChange={() => setPayOption("full")}
            className="mt-1"
          />
          <span>
            <span className="block font-body text-sm font-medium">Pay outstanding balance</span>
            <span className="font-display text-xl text-ink">
              {formatInvoiceCurrency(displayAmount, asFormatCur(payCurrency))}
            </span>
          </span>
        </label>
      </div>

      <div className="mt-4 flex gap-2">
        {(["NGN", "USD", "GBP"] as PaymentCurrency[]).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setPayCurrency(c)}
            className={`px-3 py-1 font-body text-[10px] uppercase tracking-wide ${
              payCurrency === c ? "bg-[#37392d] text-white" : "border border-[#EBEBEA]"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <PaymentMethodSelector
          currency={payCurrency}
          businessLine="ATELIER"
          amount={displayAmount}
          paymentReference={paymentRef}
          selected={gateway}
          onSelect={setGateway}
          receiptUrl={receiptUrl}
          onReceiptUploaded={setReceiptUrl}
          receiptUploadUrl={`/api/invoice/${token}/receipt`}
        />
      </div>

      {stripeClientSecret && stripePk && pay.orderId ? (
        <StripePayBlock
          clientSecret={stripeClientSecret}
          publishableKey={stripePk}
          returnUrl={
            typeof window === "undefined"
              ? ""
              : `${window.location.origin}/api/bespoke/${pay.orderId}/verify-payment?gateway=STRIPE`
          }
        />
      ) : (
        <button
          type="button"
          disabled={busy || !gateway}
          onClick={() => void submit()}
          className="mt-4 w-full bg-[#37392d] py-3 font-body text-[11px] font-medium uppercase tracking-[0.12em] text-white disabled:opacity-50"
        >
          {busy ? "Processing…" : "Pay now"}
        </button>
      )}
    </div>
  );
}
