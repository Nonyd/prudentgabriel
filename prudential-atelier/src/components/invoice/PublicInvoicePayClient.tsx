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
import { invoicePayFigures } from "@/lib/invoice-pay-options";
import { roundToKobo } from "@/lib/money";
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
  const figures = invoicePayFigures({
    remainingDepositNGN: pay.remainingDepositNGN,
    remainingBalanceNGN: pay.remainingBalanceNGN,
  });
  const available = pay.availableCurrencies ?? [];
  const initial = (pay.defaultCurrency ?? available[0] ?? null) as PaymentCurrency | null;
  const [payOption, setPayOption] = useState<PayOption>(figures.showDeposit ? "deposit" : "full");
  const [gateway, setGateway] = useState<PaymentGatewayType | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
  const [stripePk, setStripePk] = useState("");
  const [payCurrency, setPayCurrency] = useState<PaymentCurrency>(initial ?? "NGN");
  const fx = lockedFxFromAtelier({
    fxRateLocked: pay.fxRateLocked,
    fxGbpRateLocked: pay.fxGbpRateLocked,
  });
  const invoiceCurrency = asShopPayCurrency(currency);

  const depositNGN = figures.depositNGN;
  const balanceNGN = figures.balanceNGN;
  const selectedNGN = payOption === "deposit" && figures.showDeposit ? depositNGN : balanceNGN;

  function display(ngn: number, cur: PaymentCurrency): number {
    return cur === "NGN" ? roundToKobo(ngn) : convertAtLockedRate(ngn, cur, fx);
  }

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
            amount: payOption === "deposit" && figures.showDeposit ? "deposit" : "full",
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
          amount: payOption === "deposit" && figures.showDeposit ? "deposit" : "full",
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
      {invoiceCurrency !== "NGN" && payCurrency === "NGN" ? (
        <p className="mt-2 font-body text-sm text-[#6B6B68]">
          Agreed amount is in {invoiceCurrency}. Card payment is collected in naira at the rate locked on this
          commission.
        </p>
      ) : null}
      {pay.createsAccount ? (
        <p className="mt-2 font-body text-sm text-[#6B6B68]">
          Paying creates a client account so you can track this commission and confirm receipt later.
          Design approval is sent as its own email link — no login required. We email a temporary
          password to this invoice address.
        </p>
      ) : null}

      <div className="mt-4 space-y-2">
        {figures.showDeposit ? (
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
                {formatInvoiceCurrency(display(depositNGN, payCurrency), asFormatCur(payCurrency))}
              </span>
              {payCurrency === "NGN" && invoiceCurrency !== "NGN" ? (
                <span className="mt-1 block font-body text-xs text-[#6B6B68]">
                  Agreed {formatInvoiceCurrency(pay.remainingDepositDocument, invoiceCurrency as InvoiceCurrency)}{" "}
                  at the locked rate
                </span>
              ) : null}
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
              {formatInvoiceCurrency(display(balanceNGN, payCurrency), asFormatCur(payCurrency))}
            </span>
            {payCurrency === "NGN" && invoiceCurrency !== "NGN" ? (
              <span className="mt-1 block font-body text-xs text-[#6B6B68]">
                Agreed {formatInvoiceCurrency(pay.remainingBalanceDocument, invoiceCurrency as InvoiceCurrency)} at
                the locked rate
              </span>
            ) : null}
          </span>
        </label>
      </div>

      {available.length > 1 ? (
        <div className="mt-4 flex gap-2">
          {available.map((c) => (
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
      ) : available.length === 1 ? (
        <p className="mt-4 font-body text-xs uppercase tracking-wide text-[#6B6B68]">Paying in {available[0]}</p>
      ) : (
        <p className="mt-4 font-body text-sm text-ink">
          No payment method is configured for this invoice. Please contact the atelier.
        </p>
      )}

      {available.length > 0 ? (
        <div className="mt-4">
          <PaymentMethodSelector
            currency={payCurrency}
            businessLine="ATELIER"
            amount={display(selectedNGN, payCurrency)}
            amountNGN={selectedNGN}
            paymentReference={paymentRef}
            selected={gateway}
            onSelect={setGateway}
            receiptUrl={receiptUrl}
            onReceiptUploaded={setReceiptUrl}
            receiptUploadUrl={`/api/invoice/${token}/receipt`}
          />
        </div>
      ) : null}

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
          disabled={busy || !gateway || available.length === 0}
          onClick={() => void submit()}
          className="mt-4 w-full bg-[#37392d] py-3 font-body text-[11px] font-medium uppercase tracking-[0.12em] text-white disabled:opacity-50"
        >
          {busy ? "Processing…" : "Pay now"}
        </button>
      )}
    </div>
  );
}
