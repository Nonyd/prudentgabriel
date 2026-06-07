"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Coupon } from "@prisma/client";
import toast from "react-hot-toast";
import { Pencil, Trash2 } from "lucide-react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { CouponFormModal } from "@/components/admin/CouponFormModal";
import { AlertDialog as ConfirmDialog } from "@/components/ui/AlertDialog";

type Row = Coupon & { _count?: { usages: number } };

export function CouponsClient({ coupons }: { coupons: Row[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "EXPIRED" | "SCHEDULED" | "DISABLED">("ALL");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  const now = Date.now();

  const filtered = useMemo(() => {
    return coupons.filter((c) => {
      if (filter === "ALL") return true;
      const expired = c.expiresAt && new Date(c.expiresAt).getTime() < now;
      const scheduled = c.startsAt && new Date(c.startsAt).getTime() > now;
      if (filter === "DISABLED") return !c.isActive;
      if (filter === "ACTIVE") return c.isActive && !expired && !scheduled;
      if (filter === "EXPIRED") return Boolean(expired);
      if (filter === "SCHEDULED") return Boolean(scheduled) && c.isActive;
      return true;
    });
  }, [coupons, filter, now]);

  const totalUses = coupons.reduce((s, c) => s + (c._count?.usages ?? c.usedCount ?? 0), 0);

  async function toggle(id: string, isActive: boolean) {
    const res = await fetch(`/api/admin/coupons/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    if (!res.ok) toast.error("Failed");
    else {
      toast.success("Saved");
      router.refresh();
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/admin/coupons/${id}`, { method: "DELETE" });
    if (!res.ok) toast.error("Delete failed");
    else {
      toast.success("Removed");
      router.refresh();
    }
  }

  const filteredIds = useMemo(() => filtered.map((c) => c.id), [filtered]);
  const allFilteredSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));

  const toggleRowSelect = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      setSelected((prev) => {
        const n = new Set(prev);
        for (const id of filteredIds) n.delete(id);
        return n;
      });
    } else {
      setSelected((prev) => new Set([...Array.from(prev), ...filteredIds]));
    }
  };

  async function bulkDeactivate() {
    if (selected.size === 0) return;
    setBulkBusy(true);
    try {
      const ids = Array.from(selected);
      const results = await Promise.all(
        ids.map((id) =>
          fetch(`/api/admin/coupons/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isActive: false }),
          }),
        ),
      );
      if (results.some((r) => !r.ok)) toast.error("Some coupons failed to update");
      else {
        toast.success("Coupons deactivated");
        setSelected(new Set());
        router.refresh();
      }
    } finally {
      setBulkBusy(false);
    }
  }

  async function runBulkDelete() {
    if (selected.size === 0) return;
    setBulkBusy(true);
    try {
      const ids = Array.from(selected);
      for (const id of ids) {
        const res = await fetch(`/api/admin/coupons/${id}`, { method: "DELETE" });
        if (!res.ok) {
          toast.error("Some coupons could not be deleted");
          return;
        }
      }
      toast.success(`${ids.length} coupon(s) removed`);
      setSelected(new Set());
      setBulkDeleteOpen(false);
      router.refresh();
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div className="mt-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="font-body text-[13px] text-[#6B6B68]">{coupons.filter((c) => c.isActive).length} active coupons</p>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
          className="bg-[#37392d] px-4 py-2 font-body text-[11px] font-medium uppercase tracking-wide text-white"
        >
          + Create coupon
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="border border-sand bg-canvas p-4">
          <p className="font-body text-[11px] uppercase text-[#6B6B68]">Active</p>
          <p className="mt-1 font-display text-2xl">{coupons.filter((c) => c.isActive).length}</p>
        </div>
        <div className="border border-sand bg-canvas p-4">
          <p className="font-body text-[11px] uppercase text-[#6B6B68]">Total uses</p>
          <p className="mt-1 font-display text-2xl">{totalUses}</p>
        </div>
        <div className="border border-sand bg-canvas p-4">
          <p className="font-body text-[11px] uppercase text-[#6B6B68]">Revenue saved</p>
          <p className="mt-1 font-display text-2xl">—</p>
        </div>
        <div className="border border-sand bg-canvas p-4">
          <p className="font-body text-[11px] uppercase text-[#6B6B68]">Expiring soon</p>
          <p className="mt-1 font-display text-2xl">
            {
              coupons.filter(
                (c) => c.expiresAt && c.isActive && new Date(c.expiresAt).getTime() - now < 7 * 86400000 && new Date(c.expiresAt).getTime() > now,
              ).length
            }
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["ALL", "ACTIVE", "EXPIRED", "SCHEDULED", "DISABLED"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`border px-3 py-1.5 font-body text-[11px] uppercase ${
              filter === f ? "border-[#37392d] bg-[#37392d] text-white" : "border-sand text-charcoal"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title="Delete selected coupons?"
        description={`This will permanently delete ${selected.size} coupon(s). Codes in use may be blocked until refresh.`}
        variant="danger"
        confirmLabel="Delete selected"
        onConfirm={runBulkDelete}
        loading={bulkBusy}
      />

      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-sm border border-olive bg-olive p-3 text-sm text-white">
          <span className="font-medium">{selected.size} selected</span>
          <button
            type="button"
            disabled={bulkBusy}
            className="border border-white/40 px-3 py-1 text-xs hover:bg-white/10 disabled:opacity-50"
            onClick={() => void bulkDeactivate()}
          >
            Deactivate
          </button>
          <button
            type="button"
            disabled={bulkBusy}
            className="border border-white/40 bg-red-900/40 px-3 py-1 text-xs hover:bg-red-900/60 disabled:opacity-50"
            onClick={() => setBulkDeleteOpen(true)}
          >
            Delete selected
          </button>
        </div>
      ) : null}

      <div className="overflow-x-auto border border-sand bg-canvas">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="font-body text-[11px] uppercase text-[#A8A8A4]">
            <tr>
              <th className="w-10 p-3">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleSelectAllFiltered}
                  aria-label="Select all visible coupons"
                />
              </th>
              <th className="p-3">Code</th>
              <th className="p-3">Type</th>
              <th className="p-3">Value</th>
              <th className="p-3">Min</th>
              <th className="p-3">Uses</th>
              <th className="p-3">Expiry</th>
              <th className="p-3">Active</th>
              <th className="p-3"> </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-t border-sand">
                <td className="p-3">
                  <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleRowSelect(c.id)} aria-label={`Select ${c.code}`} />
                </td>
                <td className="p-3 font-mono text-sm font-semibold text-[#37392d]">{c.code}</td>
                <td className="p-3 text-xs">{c.type}</td>
                <td className="p-3">{c.type === "FREE_SHIPPING" ? "—" : c.value}</td>
                <td className="p-3 text-xs">{c.minOrderNGN ?? "—"}</td>
                <td className="p-3 text-xs">
                  {c.usedCount} / {c.maxUsesTotal ?? "∞"}
                </td>
                <td className="p-3 text-xs">{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : "None"}</td>
                <td className="p-3">
                  <input type="checkbox" checked={c.isActive} onChange={() => void toggle(c.id, c.isActive)} className="accent-[#37392d]" />
                </td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-charcoal hover:text-ink"
                      aria-label="Edit"
                      onClick={() => {
                        setEditing(c);
                        setModalOpen(true);
                      }}
                    >
                      <Pencil size={16} />
                    </button>
                    <AlertDialog.Root>
                      <AlertDialog.Trigger asChild>
                        <button type="button" className="text-red-700" aria-label="Delete">
                          <Trash2 size={16} />
                        </button>
                      </AlertDialog.Trigger>
                      <AlertDialog.Portal>
                        <AlertDialog.Overlay className="fixed inset-0 z-[130] bg-black/40" />
                        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[131] w-[min(90vw,400px)] -translate-x-1/2 -translate-y-1/2 border border-sand bg-canvas p-6 shadow-lg">
                          <AlertDialog.Title className="font-body text-sm">Delete coupon?</AlertDialog.Title>
                          <div className="mt-6 flex justify-end gap-2">
                            <AlertDialog.Cancel asChild>
                              <button type="button" className="border border-sand px-4 py-2 text-xs uppercase">
                                Cancel
                              </button>
                            </AlertDialog.Cancel>
                            <AlertDialog.Action asChild>
                              <button
                                type="button"
                                className="bg-red-700 px-4 py-2 text-xs uppercase text-white"
                                onClick={() => void remove(c.id)}
                              >
                                Delete
                              </button>
                            </AlertDialog.Action>
                          </div>
                        </AlertDialog.Content>
                      </AlertDialog.Portal>
                    </AlertDialog.Root>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CouponFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        coupon={editing}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
