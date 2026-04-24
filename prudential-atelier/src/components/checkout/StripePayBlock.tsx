"use client";

import { useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import toast from "react-hot-toast";

function Inner({ returnUrl }: { returnUrl: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
    });
    setBusy(false);
    if (error) toast.error(error.message ?? "Payment failed");
  }

  return (
    <form onSubmit={pay} className="mt-4 space-y-4">
      <PaymentElement />
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-sm bg-wine py-3 text-sm font-medium text-ivory hover:bg-wine-hover disabled:opacity-50"
      >
        {busy ? "Processing…" : "Pay with card"}
      </button>
    </form>
  );
}

export function StripePayBlock({
  clientSecret,
  publishableKey,
  returnUrl,
}: {
  clientSecret: string;
  publishableKey: string;
  returnUrl: string;
}) {
  if (!publishableKey) {
    return <p className="text-sm text-error">Stripe is not configured (missing publishable key).</p>;
  }
  const stripePromise = loadStripe(publishableKey);
  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <Inner returnUrl={returnUrl} />
    </Elements>
  );
}
