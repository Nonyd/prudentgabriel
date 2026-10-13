"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { CascadeConfirmDialog } from "@/components/admin/ProductCascadeDialog";
import { commissionDialogCopy, type CommissionCascadePreview } from "@/lib/commission-cascade-copy";

/** Delete a commission: the warning counts what goes with it before anything happens. */
export function CommissionDeleteControl({ orderId, orderRef }: { orderId: string; orderRef: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<CommissionCascadePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openDelete() {
    setOpen(true);
    setPreview(null);
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/bespoke/${orderId}/cascade`);
      const data = (await res.json()) as CommissionCascadePreview & { error?: string };
      if (!res.ok) setError(data.error ?? "Could not check what is attached");
      else setPreview(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not check what is attached");
    } finally {
      setLoading(false);
    }
  }

  async function runDelete(confirmation?: string) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/bespoke/${orderId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Delete failed");
        return;
      }
      toast.success(`${orderRef} deleted`);
      setOpen(false);
      router.push("/admin/bespoke");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button type="button" className="font-sans text-xs text-error hover:underline" onClick={() => void openDelete()}>
        Delete commission
      </button>
      <CascadeConfirmDialog
        open={open}
        copy={preview ? commissionDialogCopy(preview) : null}
        loadingPreview={loading}
        submitting={submitting}
        error={error}
        onOpenChange={(o) => {
          if (!o) {
            setOpen(false);
            setPreview(null);
            setError(null);
          }
        }}
        onConfirm={(confirmation) => void runDelete(confirmation)}
      />
    </>
  );
}
