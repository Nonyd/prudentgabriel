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
    return <p className="mt-8 font-body text-sm text-[#1B5E20]">No reviews awaiting moderation ✓</p>;
  }

  return (
    <div className="mt-8 space-y-4">
      {pending.map((r) => (
        <div
          key={r.id}
          className="border border-[#EBEBEA] border-l-[3px] border-l-[#F59E0B] bg-white p-4 text-sm text-charcoal"
        >
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
