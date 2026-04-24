"use client";

import { useRouter } from "next/navigation";
import type { Prisma } from "@prisma/client";
import toast from "react-hot-toast";

type Row = Prisma.ReviewGetPayload<{
  include: { user: { select: { name: true } }; product: { select: { name: true; slug: true } } };
}>;

export function ReviewsAdminClient({ pending }: { pending: Row[] }) {
  const router = useRouter();

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

  async function reject(id: string) {
    if (!confirm("Remove this review permanently?")) return;
    const res = await fetch(`/api/admin/reviews/${id}`, { method: "DELETE" });
    if (!res.ok) toast.error("Failed");
    else {
      toast.success("Removed");
      router.refresh();
    }
  }

  if (!pending.length) {
    return <p className="mt-8 text-emerald-400">No reviews awaiting moderation ✓</p>;
  }

  return (
    <div className="mt-8 space-y-4">
      {pending.map((r) => (
        <div key={r.id} className="rounded-sm border border-gold/10 bg-[#1E1E1E] p-4 text-sm text-ivory/90">
          <p className="font-medium text-gold">{r.product.name}</p>
          <p className="text-xs text-[#8A8A8A]">{r.user.name} · {r.rating}★</p>
          <p className="mt-2">{r.body ?? r.title}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="rounded-sm bg-emerald-900/40 px-3 py-1 text-xs text-emerald-300"
              onClick={() => void approve(r.id)}
            >
              Approve
            </button>
            <button
              type="button"
              className="rounded-sm bg-red-900/30 px-3 py-1 text-xs text-red-300"
              onClick={() => void reject(r.id)}
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
