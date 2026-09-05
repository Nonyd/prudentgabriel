"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { CascadeConfirmDialog } from "@/components/admin/ProductCascadeDialog";
import { consultationDialogCopy, type ConsultationCascadePreview } from "@/lib/consultation-cascade-copy";

type Props = {
  id: string;
  bookingNumber: string;
  afterDeleteHref?: string;
};

export function ConsultationDeleteControl({ id, bookingNumber, afterDeleteHref }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<ConsultationCascadePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openDelete() {
    setOpen(true);
    setPreview(null);
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/consultations/cascade/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ids: [id] }),
      });
      const data = (await res.json()) as ConsultationCascadePreview & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not check what is attached");
        return;
      }
      setPreview(data);
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
      const res = await fetch("/api/admin/consultations/cascade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ids: [id], confirmation }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Delete failed");
        return;
      }
      toast.success(`${bookingNumber} deleted`);
      setOpen(false);
      if (afterDeleteHref) router.push(afterDeleteHref);
      else router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button type="button" className="text-red-400 hover:underline" onClick={() => void openDelete()}>
        Delete
      </button>
      <CascadeConfirmDialog
        open={open}
        copy={preview ? consultationDialogCopy(preview) : null}
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
