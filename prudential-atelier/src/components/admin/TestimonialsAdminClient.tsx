"use client";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { Toggle } from "@/components/ui/Toggle";
import { StarRating } from "@/components/ui/StarRating";

export type TestimonialAdminRow = Prisma.TestimonialGetPayload<{
  include: { user: { select: { name: true; image: true } } };
}>;

function excerpt(text: string | null | undefined, max = 80): string {
  const t = (text ?? "").trim();
  if (!t) return "—";
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

export function TestimonialsAdminClient({ testimonials }: { testimonials: TestimonialAdminRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [productContext, setProductContext] = useState("");
  const [orderContext, setOrderContext] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return testimonials;
    return testimonials.filter((t) => {
      const hay = `${t.user.name ?? ""} ${t.body} ${t.productContext ?? ""} ${t.orderContext ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [testimonials, search]);

  async function patchTestimonial(
    id: string,
    data: {
      isApproved?: boolean;
      showOnHomepage?: boolean;
      productContext?: string | null;
      orderContext?: string | null;
      adminImage?: string | null;
    },
  ) {
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

  async function handleImageUpload(id: string, file: File) {
    setBusyId(id);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("folder", "prudential-atelier/testimonials");
      const uploadRes = await fetch("/api/admin/upload", { method: "POST", body: form, credentials: "include" });
      const uploadData = (await uploadRes.json()) as { url?: string };
      if (!uploadRes.ok || !uploadData.url) {
        toast.error("Upload failed");
        return;
      }
      await patchTestimonial(id, { adminImage: uploadData.url });
    } finally {
      setBusyId(null);
      setUploadTargetId(null);
    }
  }

  function startEdit(t: TestimonialAdminRow) {
    setEditingId(t.id);
    setProductContext(t.productContext ?? "");
    setOrderContext(t.orderContext ?? "");
  }

  function saveContext(id: string) {
    void patchTestimonial(id, {
      productContext: productContext.trim() || null,
      orderContext: orderContext.trim() || null,
    });
    setEditingId(null);
  }

  return (
    <div className="mt-6 space-y-4">
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search client or excerpt…"
        className="w-full max-w-md rounded-sm border border-[#EBEBEA] bg-canvas px-3 py-2 font-body text-sm text-charcoal outline-none focus:border-olive"
      />

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && uploadTargetId) void handleImageUpload(uploadTargetId, f);
          e.target.value = "";
        }}
      />

      <div className="-mx-4 overflow-x-auto rounded-sm border border-[#EBEBEA] bg-canvas px-4 md:mx-0 md:px-0">
        <table className="w-full min-w-[1100px] text-left text-sm text-charcoal">
          <thead className="border-b border-[#EBEBEA] font-label text-[11px] uppercase tracking-wide text-[#A8A8A4]">
            <tr>
              <th className="p-3">Client</th>
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
                <td colSpan={10} className="p-8 text-center font-body text-sm text-charcoal-mid">
                  No testimonials found.
                </td>
              </tr>
            ) : (
              filtered.map((t) => {
                const disabled = busyId === t.id;
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
                    <td className="p-3 font-body text-sm">{t.user.name ?? "—"}</td>
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
                        srLabel={`Approved — ${t.user.name}`}
                        onChange={(v) => void patchTestimonial(t.id, { isApproved: v })}
                      />
                    </td>
                    <td className="p-3">
                      <Toggle
                        checked={t.showOnHomepage}
                        disabled={disabled || !t.isApproved}
                        srLabel={`Show on homepage — ${t.user.name}`}
                        onChange={(v) => void patchTestimonial(t.id, { showOnHomepage: v })}
                      />
                    </td>
                    <td className="min-w-[180px] p-3">
                      {editingId === t.id ? (
                        <div className="space-y-2">
                          <input
                            value={productContext}
                            onChange={(e) => setProductContext(e.target.value)}
                            placeholder="Product context"
                            className="w-full rounded-sm border border-[#EBEBEA] px-2 py-1 text-xs"
                          />
                          <input
                            value={orderContext}
                            onChange={(e) => setOrderContext(e.target.value)}
                            placeholder="Order context"
                            className="w-full rounded-sm border border-[#EBEBEA] px-2 py-1 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => saveContext(t.id)}
                            className="font-body text-xs text-olive hover:underline"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <div className="font-body text-xs text-charcoal-mid">
                          {[t.productContext, t.orderContext].filter(Boolean).join(" · ") || "—"}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap p-3 font-body text-xs text-charcoal-mid">
                      {format(new Date(t.createdAt), "MMM d, yyyy")}
                    </td>
                    <td className="space-y-1 p-3">
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          setUploadTargetId(t.id);
                          fileRef.current?.click();
                        }}
                        className="block font-body text-xs text-olive hover:underline disabled:opacity-50"
                      >
                        Replace image
                      </button>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => startEdit(t)}
                        className="block font-body text-xs text-olive hover:underline disabled:opacity-50"
                      >
                        Edit context
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
