"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Prisma } from "@prisma/client";
import toast from "react-hot-toast";
import { AlertDialog } from "@/components/ui/AlertDialog";

type Row = Prisma.ReviewGetPayload<{
  include: { user: { select: { name: true } }; product: { select: { name: true; slug: true } } };
}>;

export function ReviewsAdminClient({ pending }: { pending: Row[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rejectOpen, setRejectOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const allSelected = pending.length > 0 && pending.every((r) => selected.has(r.id));

  const toggle = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(pending.map((r) => r.id)));
  };

  async function approve(id: string) {
    const res = await fetch(`/api/admin/reviews/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isApproved: true }),
    });
    if (!res.ok) toast.error("Failed");
    else {
      toast.success("Approved");
      router.refresh();
    }
  }

  async function rejectOne(id: string) {
    const res = await fetch(`/api/admin/reviews/${id}`, { method: "DELETE" });
    if (!res.ok) toast.error("Failed");
    else {
      toast.success("Removed");
      router.refresh();
    }
  }

  async function bulkApprove() {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      const ids = Array.from(selected);
      const results = await Promise.all(
        ids.map((id) =>
          fetch(`/api/admin/reviews/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isApproved: true }),
          }),
        ),
      );
      if (results.some((r) => !r.ok)) toast.error("Some reviews failed to approve");
      else {
        toast.success(`${ids.length} review(s) approved`);
        setSelected(new Set());
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function bulkReject() {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      const ids = Array.from(selected);
      for (const id of ids) {
        const res = await fetch(`/api/admin/reviews/${id}`, { method: "DELETE" });
        if (!res.ok) {
          toast.error("Some reviews could not be removed");
          return;
        }
      }
      toast.success(`${ids.length} review(s) removed`);
      setSelected(new Set());
      setRejectOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const rejectDescription = useMemo(() => {
    return `Permanently delete ${selected.size} review(s)? This cannot be undone.`;
  }, [selected.size]);

  if (!pending.length) {
    return <p className="mt-8 font-body text-sm text-[#1B5E20]">No reviews awaiting moderation ✓</p>;
  }

  return (
    <div className="mt-8 space-y-4">
      <AlertDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title="Remove selected reviews?"
        description={rejectDescription}
        variant="danger"
        confirmLabel="Remove"
        onConfirm={bulkReject}
        loading={busy}
      />

      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-sm border border-olive bg-olive p-3 text-sm text-white">
          <span className="font-medium">{selected.size} selected</span>
          <button
            type="button"
            disabled={busy}
            className="border border-white/40 px-3 py-1 text-xs hover:bg-white/10 disabled:opacity-50"
            onClick={() => void bulkApprove()}
          >
            Approve selected
          </button>
          <button
            type="button"
            disabled={busy}
            className="border border-white/40 bg-red-900/40 px-3 py-1 text-xs hover:bg-red-900/60 disabled:opacity-50"
            onClick={() => setRejectOpen(true)}
          >
            Remove selected
          </button>
        </div>
      ) : null}

      <div className="flex items-center gap-2 border-b border-[#EBEBEA] pb-2 font-body text-xs text-[#6B6B68]">
        <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all pending reviews" />
        <span>Select all</span>
      </div>

      {pending.map((r) => (
        <div
          key={r.id}
          className="border border-[#EBEBEA] border-l-[3px] border-l-[#F59E0B] bg-canvas p-4 text-sm text-charcoal"
        >
          <div className="flex gap-3">
            <input type="checkbox" className="mt-1" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Select review ${r.id}`} />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-olive">{r.product.name}</p>
              <p className="text-xs text-[#A8A8A4]">
                {r.user.name} · {r.rating}★
              </p>
              <p className="mt-2">{r.body ?? r.title}</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="bg-[#E8F5E9] px-3 py-1.5 font-body text-[11px] text-[#1B5E20] transition-colors hover:bg-[#22C55E] hover:text-white"
                  onClick={() => void approve(r.id)}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="bg-[#FDECEA] px-3 py-1.5 font-body text-[11px] text-[#8B1A1A] transition-colors hover:bg-[#8B1A1A] hover:text-white"
                  onClick={() => void rejectOne(r.id)}
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
