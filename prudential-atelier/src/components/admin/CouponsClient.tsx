"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Coupon } from "@prisma/client";
import toast from "react-hot-toast";
import { Pencil, Trash2 } from "lucide-react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { CouponFormModal } from "@/components/admin/CouponFormModal";

type Row = Coupon & { _count?: { usages: number } };

export function CouponsClient({ coupons }: { coupons: Row[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "EXPIRED" | "SCHEDULED" | "DISABLED">("ALL");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);

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
        <div className="border border-[#EBEBEA] bg-canvas p-4">
          <p className="font-body text-[11px] uppercase text-[#6B6B68]">Active</p>
          <p className="mt-1 font-display text-2xl">{coupons.filter((c) => c.isActive).length}</p>
        </div>
        <div className="border border-[#EBEBEA] bg-canvas p-4">
          <p className="font-body text-[11px] uppercase text-[#6B6B68]">Total uses</p>
          <p className="mt-1 font-display text-2xl">{totalUses}</p>
        </div>
        <div className="border border-[#EBEBEA] bg-canvas p-4">
          <p className="font-body text-[11px] uppercase text-[#6B6B68]">Revenue saved</p>
          <p className="mt-1 font-display text-2xl">—</p>
        </div>
        <div className="border border-[#EBEBEA] bg-canvas p-4">
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
              filter === f ? "border-[#37392d] bg-[#37392d] text-white" : "border-[#EBEBEA] text-charcoal"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto border border-[#EBEBEA] bg-canvas">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="font-body text-[11px] uppercase text-[#A8A8A4]">
            <tr>
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
              <tr key={c.id} className="border-t border-[#EBEBEA]">
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
                        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[131] w-[min(90vw,400px)] -translate-x-1/2 -translate-y-1/2 border border-[#EBEBEA] bg-canvas p-6 shadow-lg">
                          <AlertDialog.Title className="font-body text-sm">Delete coupon?</AlertDialog.Title>
                          <div className="mt-6 flex justify-end gap-2">
                            <AlertDialog.Cancel asChild>
                              <button type="button" className="border border-[#EBEBEA] px-4 py-2 text-xs uppercase">
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
