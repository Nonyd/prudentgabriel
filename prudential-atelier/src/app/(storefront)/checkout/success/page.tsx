"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";

function SuccessInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { status } = useSession();
  const trackHref = status === "authenticated" ? "/account/orders" : "/auth/login?callbackUrl=/account/orders";
  const orderNumber = searchParams.get("order");
  const emailParam = searchParams.get("email") ?? "";

  const [order, setOrder] = useState<{
    orderNumber: string;
    guestEmail: string | null;
    total: number;
    items: { name: string; size: string | null; quantity: number; lineTotal: number }[];
    shippingZone: { name: string } | null;
    shippingAmount: number;
  } | null>(null);

  useEffect(() => {
    if (!orderNumber) {
      router.replace("/shop");
      return;
    }
    const q = emailParam ? `?email=${encodeURIComponent(emailParam)}` : "";
    void fetch(`/api/orders/${encodeURIComponent(orderNumber)}${q}`)
      .then((r) => r.json())
      .then((j) => setOrder(j.order))
      .catch(() => setOrder(null));
  }, [orderNumber, emailParam, router]);

  useEffect(() => {
    void import("canvas-confetti").then((m) =>
      m.default({ particleCount: 100, spread: 70, colors: ["#6B1C2A", "#C9A84C", "#FAF6EF"], origin: { y: 0.3 } }),
    );
  }, []);

  if (!orderNumber) return null;

  const email = order?.guestEmail ?? emailParam;

  return (
    <div className="mx-auto max-w-lg px-5 py-20 text-center">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border-2 border-wine text-4xl text-wine">
        ✓
      </motion.div>
      <h1 className="mt-6 font-display text-3xl text-wine">Order placed!</h1>
      <p className="mt-2 font-label text-lg text-gold">#{orderNumber}</p>
      {email && <p className="mt-4 text-sm text-charcoal-mid">Confirmation sent to {email}</p>}
      <div className="mt-8 rounded-sm border border-border bg-cream p-6 text-left text-sm">
        {(order?.items ?? []).map((it, i) => (
          <div key={i} className="flex justify-between border-b border-border/60 py-2 last:border-0">
            <span>
              {it.name} · {it.size ?? "—"} ×{it.quantity}
            </span>
            <span>₦{Math.round(it.lineTotal).toLocaleString()}</span>
          </div>
        ))}
        {order && (
          <p className="mt-4 flex justify-between font-medium">
            <span>Total</span>
            <span>₦{Math.round(order.total).toLocaleString()}</span>
          </p>
        )}
      </div>
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <Link href={trackHref} className="rounded-sm bg-wine px-6 py-2 text-sm text-ivory">
          Track my order
        </Link>
        <Link href="/shop" className="rounded-sm border border-wine px-6 py-2 text-sm text-wine">
          Continue shopping
        </Link>
      </div>
      {status === "unauthenticated" && email && (
        <div className="mt-10 rounded-sm border border-gold bg-ivory p-6 text-left text-sm">
          <p className="font-medium text-wine">Save your order history</p>
          <p className="mt-2 text-charcoal-mid">Create a free account with the same email to access your orders.</p>
          <Link href={`/auth/register?email=${encodeURIComponent(email)}`} className="mt-4 inline-block rounded-sm bg-wine px-4 py-2 text-ivory">
            Create account
          </Link>
        </div>
      )}
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
