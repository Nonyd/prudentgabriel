"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { useCartStore } from "@/store/cartStore";
import { formatPrice } from "@/lib/utils";
import { rtwTrackerStatusLabel } from "@/lib/rtw-tracker";
import type { PublicRtwOrderDto } from "@/lib/public-pii-dtos";

function SuccessInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderNumber = searchParams.get("order");
  const emailParam = searchParams.get("email") ?? "";

  const [order, setOrder] = useState<PublicRtwOrderDto | null>(null);
  const [lookupFailed, setLookupFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!orderNumber) {
          router.replace("/rtw");
      return;
    }
    const q = emailParam ? `?email=${encodeURIComponent(emailParam)}` : "";
    void fetch(`/api/orders/${encodeURIComponent(orderNumber)}${q}`)
      .then(async (r) => {
        if (!r.ok) {
          setLookupFailed(true);
          setOrder(null);
          setLoaded(true);
          return;
        }
        const j = (await r.json()) as { order?: PublicRtwOrderDto | null };
        const next = j.order ?? null;
        setOrder(next);
        setLookupFailed(!next);
        setLoaded(true);
        if (next?.paymentStatus === "PAID") {
          useCartStore.getState().clearCart();
        }
      })
      .catch(() => {
        setLookupFailed(true);
        setOrder(null);
        setLoaded(true);
      });
  }, [orderNumber, emailParam, router]);

  useEffect(() => {
    void import("canvas-confetti").then((m) =>
      m.default({ particleCount: 100, spread: 70, colors: ["#442913", "#C9A84C", "#F7F2EC"], origin: { y: 0.3 } }),
    );
  }, []);

  if (!orderNumber) return null;

  const paidLabel =
    order?.paid != null
      ? formatPrice(order.paid.amount, order.paid.currency)
      : null;

  return (
    <div className="mx-auto max-w-lg px-5 py-20 text-center">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border-2 border-choc text-4xl text-choc"
      >
        ✓
      </motion.div>
      <h1 className="mt-6 font-display text-3xl text-choc">
        {order ? rtwTrackerStatusLabel(order.status, order.paymentStatus) : "Your order"}
      </h1>
      <p className="mt-2 font-label text-lg text-gold">#{orderNumber}</p>
      {emailParam ? (
        <p className="mt-4 text-sm text-charcoal-mid">A confirmation is on its way to {emailParam}</p>
      ) : null}

      {lookupFailed && !order ? (
        <p className="mt-8 font-body text-base text-charcoal" role="alert">
          We could not open this order. Use the link in your email.
        </p>
      ) : null}

      {loaded && order ? (
        <div className="mt-8 glass-2 glass-panel p-6 text-left text-sm">
          {order.items.map((it, i) => (
            <div key={i} className="flex justify-between gap-3 border-b border-border/60 py-2 last:border-0">
              <span>
                {it.name} · {it.size} ×{it.quantity}
              </span>
            </div>
          ))}
          {paidLabel ? (
            <p className="mt-4 flex justify-between font-medium">
              <span>Paid</span>
              <span>{paidLabel}</span>
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <Link href="/rtw" className="rounded-sm bg-choc px-6 py-2 text-sm text-cream">
          Continue shopping
        </Link>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<div className="py-24 text-center text-charcoal-mid">Loading…</div>}>
      <SuccessInner />
    </Suspense>
  );
}
