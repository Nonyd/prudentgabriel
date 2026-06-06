"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { Toggle } from "@/components/ui/Toggle";
import { StarRating } from "@/components/ui/StarRating";
import { TestimonialFormModal, clientLabel } from "@/components/admin/TestimonialFormModal";

export type TestimonialAdminRow = Prisma.TestimonialGetPayload<{
  include: { user: { select: { name: true; image: true; email: true } } };
}>;

function excerpt(text: string | null | undefined, max = 80): string {
  const t = (text ?? "").trim();
  if (!t) return "—";
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

function SourcePill({ source }: { source: string }) {
  const isClient = source === "CLIENT";
  return (
    <span
      className="inline-block rounded-sm px-2 py-0.5 font-label text-[9px] uppercase tracking-wide"
      style={
        isClient
          ? { background: "rgba(34,197,94,0.1)", color: "#166534" }
          : { background: "rgba(245,158,11,0.1)", color: "#92400e" }
      }
    >
      {isClient ? "CLIENT" : "MANUAL"}
    </span>
  );
}

export function TestimonialsAdminClient({ testimonials }: { testimonials: TestimonialAdminRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TestimonialAdminRow | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return testimonials;
    return testimonials.filter((t) => {
      const clientName = t.user?.name ?? t.displayName ?? "";
      const hay = `${clientName} ${t.body} ${t.productContext ?? ""} ${t.orderContext ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [testimonials, search]);

  async function patchTestimonial(id: string, data: { isApproved?: boolean; showOnHomepage?: boolean }) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/testimonials/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        toast.error("Could not save testimonial");
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function deleteTestimonial(id: string) {
    if (!window.confirm("Delete this testimonial?")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/testimonials/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        toast.error("Could not delete testimonial");
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(t: TestimonialAdminRow) {
    setEditing(t);
    setModalOpen(true);
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search client or excerpt…"
          className="w-full max-w-md rounded-sm border border-[#EBEBEA] bg-canvas px-3 py-2 font-body text-sm text-charcoal outline-none focus:border-olive"
        />
        <button
          type="button"
          onClick={openCreate}
          className="rounded-[3px] bg-choc px-5 py-2.5 font-label text-[11px] font-semibold uppercase tracking-wide text-cream"
        >
          + Add Testimonial
        </button>
      </div>

      <TestimonialFormModal
        open={modalOpen}
        onOpenChange={(next) => {
          setModalOpen(next);
          if (!next) setEditing(null);
        }}
        testimonial={editing}
      />

      <div className="-mx-4 overflow-x-auto rounded-sm border border-[#EBEBEA] bg-canvas px-4 md:mx-0 md:px-0">
        <table className="w-full min-w-[1100px] text-left text-sm text-charcoal">
          <thead className="border-b border-[#EBEBEA] font-label text-[11px] uppercase tracking-wide text-[#A8A8A4]">
            <tr>
              <th className="p-3">Client</th>
              <th className="p-3">Source</th>
              <th className="p-3">Rating</th>
              <th className="p-3">Excerpt</th>
              <th className="p-3">Client photo</th>
              <th className="p-3">Admin photo</th>
              <th className="p-3">Approved</th>
              <th className="p-3">Homepage</th>
              <th className="p-3">Context</th>
              <th className="p-3">Date</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={11} className="p-8 text-center font-body text-sm text-charcoal-mid">
                  No testimonials found.
                </td>
              </tr>
            ) : (
              filtered.map((t) => {
                const disabled = busyId === t.id;
                const label = clientLabel(t);
                const thumb = (url: string | null) =>
                  url ? (
                    <div className="relative h-10 w-10 overflow-hidden rounded-sm">
                      <Image src={url} alt="" fill className="object-cover" sizes="40px" />
                    </div>
                  ) : (
                    <span className="text-xs text-charcoal-mid">—</span>
                  );

                return (
                  <tr key={t.id} className="border-b border-[#F5F5F3] hover:bg-[#FAFAFA]">
                    <td className="p-3 font-body text-sm">{t.user?.name ?? t.displayName ?? "—"}</td>
                    <td className="p-3">
                      <SourcePill source={t.source} />
                    </td>
                    <td className="p-3">
                      <StarRating rating={t.rating} size="sm" variant="gold" />
                    </td>
                    <td className="max-w-[200px] p-3 font-body text-xs text-charcoal-mid">{excerpt(t.body)}</td>
                    <td className="p-3">{thumb(t.clientImage)}</td>
                    <td className="p-3">{thumb(t.adminImage)}</td>
                    <td className="p-3">
                      <Toggle
                        checked={t.isApproved}
                        disabled={disabled}
                        srLabel={`Approved — ${label}`}
                        onChange={(v) => void patchTestimonial(t.id, { isApproved: v })}
                      />
                    </td>
                    <td className="p-3">
                      <Toggle
                        checked={t.showOnHomepage}
                        disabled={disabled || !t.isApproved}
                        srLabel={`Show on homepage — ${label}`}
                        onChange={(v) => void patchTestimonial(t.id, { showOnHomepage: v })}
                      />
                    </td>
                    <td className="min-w-[180px] p-3">
                      <div className="font-body text-xs text-charcoal-mid">
                        {[t.productContext, t.orderContext].filter(Boolean).join(" · ") || "—"}
                      </div>
                    </td>
                    <td className="whitespace-nowrap p-3 font-body text-xs text-charcoal-mid">
                      {format(new Date(t.createdAt), "MMM d, yyyy")}
                    </td>
                    <td className="space-y-1 p-3">
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => openEdit(t)}
                        className="block font-body text-xs text-olive hover:underline disabled:opacity-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => void deleteTestimonial(t.id)}
                        className="block font-body text-xs text-red-700 hover:underline disabled:opacity-50"
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
    </div>
  );
}
