"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { Toggle } from "@/components/ui/Toggle";
import { StarRating } from "@/components/ui/StarRating";
import { getDeliveryModeLabel } from "@/lib/consultation";

export type ReviewAdminRow = Prisma.ReviewGetPayload<{
  include: {
    user: { select: { name: true } };
    product: { select: { name: true; slug: true } };
    consultation: {
      select: {
        offering: { select: { deliveryMode: true } };
      };
    };
  };
}>;

type FilterTab = "all" | "approved" | "pending";

function excerpt(text: string | null | undefined, max = 80): string {
  const t = (text ?? "").trim();
  if (!t) return "—";
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

type ReviewsAdminClientProps = {
  reviews: ReviewAdminRow[];
  variant: "product" | "consultation";
};

export function ReviewsAdminClient({ reviews, variant }: ReviewsAdminClientProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reviews.filter((r) => {
      if (filter === "approved" && !r.isApproved) return false;
      if (filter === "pending" && r.isApproved) return false;
      if (!q) return true;
      const productName = r.product?.name ?? "";
      const hay = `${r.user.name ?? ""} ${productName} ${r.title ?? ""} ${r.body ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [reviews, filter, search]);

  async function patchReview(
    id: string,
    data: { isApproved?: boolean; showOnHomepage?: boolean; showOnConsultationPage?: boolean },
  ) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        toast.error("Could not save review");
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function deleteReview(id: string) {
    if (!window.confirm("Delete this review?")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        toast.error("Could not delete review");
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  const tabs: { id: FilterTab; label: string }[] = [
    { id: "all", label: "All" },
    { id: "approved", label: "Approved" },
    { id: "pending", label: "Pending" },
  ];

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1 rounded-sm border border-[#EBEBEA] bg-canvas p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`rounded-sm px-3 py-1.5 font-body text-xs transition-colors ${
                filter === tab.id ? "bg-olive text-white" : "text-charcoal hover:bg-light-grey"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={variant === "product" ? "Search client or product…" : "Search client…"}
          className="min-w-[200px] flex-1 rounded-sm border border-[#EBEBEA] bg-canvas px-3 py-2 font-body text-sm text-charcoal outline-none focus:border-olive"
        />
      </div>

      <div className="-mx-4 overflow-x-auto rounded-sm border border-[#EBEBEA] bg-canvas px-4 md:mx-0 md:px-0">
        <table className="w-full min-w-[960px] text-left text-sm text-charcoal">
          <thead className="border-b border-[#EBEBEA] font-label text-[11px] uppercase tracking-wide text-[#A8A8A4]">
            <tr>
              <th className="p-3">Client</th>
              {variant === "product" ? <th className="p-3">Product</th> : <th className="p-3">Consultation type</th>}
              <th className="p-3">Rating</th>
              <th className="p-3">Excerpt</th>
              <th className="p-3">Approved</th>
              {variant === "product" ? <th className="p-3">Homepage</th> : <th className="p-3">Consultation page</th>}
              <th className="p-3">Date</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center font-body text-sm text-charcoal-mid">
                  No reviews match this filter.
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const disabled = busyId === r.id;
                const consultationType = r.consultation?.offering
                  ? getDeliveryModeLabel(r.consultation.offering.deliveryMode)
                  : "—";
                return (
                  <tr key={r.id} className="border-b border-[#F5F5F3] hover:bg-[#FAFAFA]">
                    <td className="p-3 font-body text-sm">{r.user.name ?? "—"}</td>
                    <td className="p-3">
                      {variant === "product" && r.product ? (
                        <a href={`/shop/${r.product.slug}`} className="font-body text-sm text-olive hover:underline">
                          {r.product.name}
                        </a>
                      ) : (
                        <span className="font-body text-sm">{consultationType}</span>
                      )}
                    </td>
                    <td className="p-3">
                      <StarRating rating={r.rating} size="sm" variant="gold" />
                    </td>
                    <td className="max-w-[240px] p-3 font-body text-xs text-charcoal-mid">
                      {excerpt(r.body ?? r.title)}
                    </td>
                    <td className="p-3">
                      <Toggle
                        checked={r.isApproved}
                        disabled={disabled}
                        srLabel={`Approved — ${r.user.name}`}
                        onChange={(v) => void patchReview(r.id, { isApproved: v })}
                      />
                    </td>
                    <td className="p-3">
                      {variant === "product" ? (
                        <Toggle
                          checked={r.showOnHomepage}
                          disabled={disabled || !r.isApproved}
                          srLabel={`Show on homepage — ${r.user.name}`}
                          onChange={(v) => void patchReview(r.id, { showOnHomepage: v })}
                        />
                      ) : (
                        <Toggle
                          checked={r.showOnConsultationPage}
                          disabled={disabled || !r.isApproved}
                          srLabel={`Show on consultation page — ${r.user.name}`}
                          onChange={(v) => void patchReview(r.id, { showOnConsultationPage: v })}
                        />
                      )}
                    </td>
                    <td className="whitespace-nowrap p-3 font-body text-xs text-charcoal-mid">
                      {format(new Date(r.createdAt), "MMM d, yyyy")}
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => void deleteReview(r.id)}
                        className="font-body text-xs text-red-700 hover:underline disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="font-body text-xs text-charcoal-mid">
        {filtered.length} of {reviews.length} review{reviews.length === 1 ? "" : "s"}
      </p>
    </div>
  );
}
