"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { AlertDialog } from "@/components/ui/AlertDialog";
import { useState } from "react";

export type AccountOrderRow = {
  id: string;
  orderNumber: string;
  createdAt: string;
  total: number;
  status: string;
  paymentStatus: string;
  previewImages: string[];
  canDelete: boolean;
};

export function AccountOrdersList({ orders }: { orders: AccountOrderRow[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const runDelete = async () => {
    if (!pendingId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/account/orders/${pendingId}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Could not remove order");
        return;
      }
      toast.success("Order removed from your list");
      setPendingId(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  if (orders.length === 0) {
    return (
      <p className="text-charcoal-mid">
        No orders yet.{" "}
        <Link href="/shop" className="text-wine underline">
          Browse collection
        </Link>
      </p>
    );
  }

  return (
    <>
      <AlertDialog
        open={pendingId !== null}
        onOpenChange={(o) => !o && setPendingId(null)}
        title="Remove this order?"
        description="This permanently deletes the order record from your account. Only do this for abandoned checkouts or failed payments."
        variant="danger"
        confirmLabel="Remove"
        onConfirm={runDelete}
        loading={busy}
      />
      <div className="mt-8 space-y-4">
        {orders.map((o) => (
          <div
            key={o.id}
            className="flex flex-wrap items-center justify-between gap-4 rounded-sm border border-border bg-cream p-4 hover:border-wine/30"
          >
            <Link href={`/account/orders/${o.id}`} className="min-w-0 flex-1">
              <p className="font-label text-xs text-gold">{o.orderNumber}</p>
              <p className="text-sm text-charcoal-light">{new Date(o.createdAt).toLocaleString()}</p>
              <div className="mt-2 flex -space-x-2">
                {o.previewImages.map((src, idx) => (
                  <Image
                    key={`${o.id}-${idx}`}
                    src={src}
                    alt=""
                    width={40}
                    height={48}
                    className="relative rounded-sm border-2 border-ivory object-cover"
                  />
                ))}
              </div>
            </Link>
            <div className="flex flex-col items-end gap-2 text-right">
              <p className="font-medium">₦{Math.round(o.total).toLocaleString()}</p>
              <span className="text-xs uppercase text-charcoal-mid">{o.status}</span>
              {o.canDelete ? (
                <button
                  type="button"
                  className="text-xs text-red-700 underline hover:no-underline"
                  onClick={(e) => {
                    e.preventDefault();
                    setPendingId(o.id);
                  }}
                >
                  Remove from list
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
