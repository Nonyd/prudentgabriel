"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import toast from "react-hot-toast";

export function ReceiptConfirmClient({ token }: { token: string }) {
  const router = useRouter();
  const [order, setOrder] = useState<{
    id: string;
    orderRef: string;
    clientName: string;
    receiptConfirmedAt: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/receipt/${token}/confirm`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.order) setOrder(data.order);
      setLoading(false);
    })();
  }, [token]);

  async function confirm() {
    setConfirming(true);
    try {
      const res = await fetch(`/api/receipt/${token}/confirm`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 && data.loginRequired) {
        router.push(`/login?callbackUrl=${encodeURIComponent(`/receipt/${token}`)}`);
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Could not confirm");
      toast.success("Receipt confirmed");
      router.push(`/account/orders/bespoke/${data.orderId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setConfirming(false);
    }
  }

  if (loading) {
    return <p className="font-sans text-sm text-text-mid">Loading…</p>;
  }
  if (!order) {
    return <p className="font-sans text-sm text-red-700">This confirmation link is invalid.</p>;
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="font-display text-3xl text-choc">Confirm receipt</h1>
      <p className="mt-3 font-sans text-sm text-text-mid">
        Commission <strong>{order.orderRef}</strong>
        {order.receiptConfirmedAt
          ? " has already been confirmed."
          : " — please confirm you have received your garment."}
      </p>
      {!order.receiptConfirmedAt ? (
        <Button className="mt-8" onClick={confirm} disabled={confirming}>
          {confirming ? "Confirming…" : "I have received my garment"}
        </Button>
      ) : null}
    </div>
  );
}
