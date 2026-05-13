"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { AlertDialog } from "@/components/ui/AlertDialog";

export function CustomerOrderDeleteButton({
  orderId,
  orderNumber,
  canDelete,
}: {
  orderId: string;
  orderNumber: string;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!canDelete) return null;

  const runDelete = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/account/orders/${orderId}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Could not remove order");
        return;
      }
      toast.success("Order removed");
      router.push("/account/orders");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AlertDialog
        open={open}
        onOpenChange={setOpen}
        title="Remove this order?"
        description={`Remove ${orderNumber} from your account. Use this only for abandoned checkouts or failed payments.`}
        variant="danger"
        confirmLabel="Remove order"
        onConfirm={runDelete}
        loading={busy}
      />
      <button type="button" className="mt-6 text-sm text-red-700 underline hover:no-underline" onClick={() => setOpen(true)}>
        Remove unpaid order from my account
      </button>
    </>
  );
}
