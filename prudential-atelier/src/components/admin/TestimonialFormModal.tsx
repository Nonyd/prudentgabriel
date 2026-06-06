"use client";

import { useCallback, useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { LoyaltyTier } from "@prisma/client";
import { X } from "lucide-react";
import toast from "react-hot-toast";
import { StarRating } from "@/components/ui/StarRating";
import { Toggle } from "@/components/ui/Toggle";
import { TIER_LABELS } from "@/lib/loyalty";
import { getInitials } from "@/lib/utils";
import type { TestimonialAdminRow } from "@/components/admin/TestimonialsAdminClient";

type ClientSearchResult = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  clientProfile: { loyaltyTier: LoyaltyTier } | null;
};

type Mode = "client" | "anonymous";

type TestimonialFormModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  testimonial?: TestimonialAdminRow | null;
};

function clientLabel(t: TestimonialAdminRow): string {
  return t.user?.name ?? t.displayName ?? "Testimonial";
}

export function TestimonialFormModal({ open, onOpenChange, testimonial }: TestimonialFormModalProps) {
  const router = useRouter();
  const isEdit = Boolean(testimonial);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<Mode>("client");
  const [clientQuery, setClientQuery] = useState("");
  const [clientResults, setClientResults] = useState<ClientSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientSearchResult | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [location, setLocation] = useState("");
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [productContext, setProductContext] = useState("");
  const [orderContext, setOrderContext] = useState("");
  const [adminImage, setAdminImage] = useState<string | null>(null);
  const [isApproved, setIsApproved] = useState(true);
  const [showOnHomepage, setShowOnHomepage] = useState(false);
  const [uploading, setUploading] = useState(false);

  const resetForm = useCallback(() => {
    if (testimonial) {
      const hasUser = Boolean(testimonial.userId);
      setMode(hasUser ? "client" : "anonymous");
      setClientQuery("");
      setClientResults([]);
      setSelectedClient(
        hasUser && testimonial.userId
          ? {
              id: testimonial.userId,
              name: testimonial.user?.name ?? null,
              email: testimonial.user?.email ?? null,
              image: testimonial.user?.image ?? null,
              clientProfile: null,
            }
          : null,
      );
      setDisplayName(testimonial.displayName ?? "");
      setLocation(testimonial.location ?? "");
      setRating(testimonial.rating);
      setBody(testimonial.body);
      setProductContext(testimonial.productContext ?? "");
      setOrderContext(testimonial.orderContext ?? "");
      setAdminImage(testimonial.adminImage);
      setIsApproved(testimonial.isApproved);
      setShowOnHomepage(testimonial.showOnHomepage);
      return;
    }

    setMode("client");
    setClientQuery("");
    setClientResults([]);
    setSelectedClient(null);
    setDisplayName("");
    setLocation("");
    setRating(5);
    setBody("");
    setProductContext("");
    setOrderContext("");
    setAdminImage(null);
    setIsApproved(true);
    setShowOnHomepage(false);
  }, [testimonial]);

  useEffect(() => {
    if (open) resetForm();
  }, [open, resetForm]);

  useEffect(() => {
    if (!open || mode !== "client") return;
    const q = clientQuery.trim();
    if (q.length < 2) {
      setClientResults([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/admin/clients/search?q=${encodeURIComponent(q)}`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const data = (await res.json()) as ClientSearchResult[];
        setClientResults(data);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [clientQuery, mode, open]);

  async function handlePhotoUpload(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Photo must be 5MB or less");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("folder", "prudential-atelier/testimonials");
      const res = await fetch("/api/admin/upload", { method: "POST", body: form, credentials: "include" });
      const data = (await res.json()) as { url?: string };
      if (!res.ok || !data.url) {
        toast.error("Upload failed");
        return;
      }
      setAdminImage(data.url);
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    if (rating < 1) {
      toast.error("Select a star rating");
      return;
    }
    if (body.trim().length < 30) {
      toast.error("Testimonial must be at least 30 characters");
      return;
    }
    if (mode === "client" && !selectedClient) {
      toast.error("Select a client from search results");
      return;
    }
    if (mode === "anonymous" && displayName.trim().length < 2) {
      toast.error("Enter a display name (min 2 characters)");
      return;
    }

    const payload = {
      userId: mode === "client" ? selectedClient?.id : null,
      displayName: mode === "anonymous" ? displayName.trim() : null,
      location: mode === "anonymous" ? location.trim() || null : null,
      body: body.trim(),
      rating,
      adminImage,
      productContext: productContext.trim() || null,
      orderContext: orderContext.trim() || null,
      isApproved,
      showOnHomepage: isApproved ? showOnHomepage : false,
    };

    setSaving(true);
    try {
      const res = await fetch(isEdit ? `/api/admin/testimonials/${testimonial!.id}` : "/api/admin/testimonials", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        toast.error("Could not save testimonial");
        return;
      }
      toast.success(isEdit ? "Testimonial updated" : "Testimonial saved");
      onOpenChange(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[120] bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[121] max-h-[90vh] w-[min(96vw,560px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[3px] border border-[#EBEBEA] bg-canvas p-6 shadow-lg">
          <div className="flex items-start justify-between gap-4">
            <Dialog.Title className="font-display text-[22px] text-ink">
              {isEdit ? "Update Testimonial" : "Add Testimonial"}
            </Dialog.Title>
            <Dialog.Close className="text-charcoal" aria-label="Close">
              <X size={20} />
            </Dialog.Close>
          </div>

          <div className="mt-6 space-y-6">
            <fieldset>
              <legend className="font-label text-[10px] uppercase tracking-wide text-[#A8A8A4]">Client</legend>
              <div className="mt-2 flex flex-wrap gap-4">
                <label className="flex cursor-pointer items-center gap-2 font-body text-sm text-charcoal">
                  <input
                    type="radio"
                    name="client-mode"
                    checked={mode === "client"}
                    onChange={() => {
                      setMode("client");
                      setDisplayName("");
                      setLocation("");
                    }}
                  />
                  Existing client
                </label>
                <label className="flex cursor-pointer items-center gap-2 font-body text-sm text-charcoal">
                  <input
                    type="radio"
                    name="client-mode"
                    checked={mode === "anonymous"}
                    onChange={() => {
                      setMode("anonymous");
                      setSelectedClient(null);
                      setClientQuery("");
                      setClientResults([]);
                    }}
                  />
                  Anonymous / manual entry
                </label>
              </div>

              {mode === "client" ? (
                <div className="relative mt-3">
                  <input
                    value={selectedClient ? selectedClient.name ?? selectedClient.email ?? "" : clientQuery}
                    onChange={(e) => {
                      setSelectedClient(null);
                      setClientQuery(e.target.value);
                    }}
                    placeholder="Search by name or email…"
                    className="w-full rounded-sm border border-[#EBEBEA] bg-white px-3 py-2 font-body text-sm outline-none focus:border-olive"
                  />
                  {searching ? (
                    <p className="mt-1 font-body text-xs text-charcoal-mid">Searching…</p>
                  ) : null}
                  {!selectedClient && clientResults.length > 0 ? (
                    <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-sm border border-[#EBEBEA] bg-white shadow-md">
                      {clientResults.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedClient(c);
                              setClientQuery("");
                              setClientResults([]);
                            }}
                            className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-[#FAFAFA]"
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lightbr font-label text-xs text-choc">
                              {getInitials(c.name ?? c.email ?? "?")}
                            </span>
                            <span>
                              <span className="block font-body text-sm text-charcoal">{c.name ?? "—"}</span>
                              <span className="block font-body text-xs text-charcoal-mid">
                                {c.email ?? "—"}
                                {c.clientProfile?.loyaltyTier
                                  ? ` · ${TIER_LABELS[c.clientProfile.loyaltyTier].toUpperCase()} tier`
                                  : ""}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="font-body text-xs text-charcoal-mid">Display name</label>
                    <input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder='e.g. "Chidinma E."'
                      className="mt-1 w-full rounded-sm border border-[#EBEBEA] px-3 py-2 font-body text-sm outline-none focus:border-olive"
                    />
                  </div>
                  <div>
                    <label className="font-body text-xs text-charcoal-mid">Location (optional)</label>
                    <input
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder='e.g. "Lagos, Nigeria"'
                      className="mt-1 w-full rounded-sm border border-[#EBEBEA] px-3 py-2 font-body text-sm outline-none focus:border-olive"
                    />
                  </div>
                </div>
              )}
            </fieldset>

            <div>
              <p className="font-label text-[10px] uppercase tracking-wide text-[#A8A8A4]">Rating</p>
              <StarRating
                rating={rating}
                size="lg"
                variant="gold"
                interactive
                onChange={setRating}
                className="mt-2"
              />
            </div>

            <div>
              <label className="font-label text-[10px] uppercase tracking-wide text-[#A8A8A4]">Testimonial</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                maxLength={600}
                className="mt-2 w-full resize-y rounded-sm border border-[#EBEBEA] px-3 py-2 font-body text-sm outline-none focus:border-olive"
              />
              <p className="mt-1 text-right font-body text-xs text-charcoal-mid">
                {body.length}/600 · min 30
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="font-body text-xs text-charcoal-mid">Product / piece</label>
                <input
                  value={productContext}
                  onChange={(e) => setProductContext(e.target.value)}
                  placeholder='e.g. "Custom Asoebi Gown"'
                  className="mt-1 w-full rounded-sm border border-[#EBEBEA] px-3 py-2 font-body text-sm outline-none focus:border-olive"
                />
              </div>
              <div>
                <label className="font-body text-xs text-charcoal-mid">Order type</label>
                <input
                  value={orderContext}
                  onChange={(e) => setOrderContext(e.target.value)}
                  placeholder='e.g. "Atelier Commission"'
                  className="mt-1 w-full rounded-sm border border-[#EBEBEA] px-3 py-2 font-body text-sm outline-none focus:border-olive"
                />
              </div>
            </div>

            <div>
              <p className="font-label text-[10px] uppercase tracking-wide text-[#A8A8A4]">Photo (optional)</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <label className="cursor-pointer border border-[#EBEBEA] px-3 py-2 font-body text-xs text-charcoal hover:bg-[#FAFAFA]">
                  {uploading ? "Uploading…" : "Upload photo"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handlePhotoUpload(f);
                      e.target.value = "";
                    }}
                  />
                </label>
                <span className="font-body text-xs text-charcoal-mid">JPG, PNG · Max 5MB</span>
              </div>
              {adminImage ? (
                <div className="relative mt-3 h-20 w-20 overflow-hidden rounded-sm">
                  <Image src={adminImage} alt="" fill className="object-cover" sizes="80px" />
                </div>
              ) : null}
            </div>

            <div className="space-y-3 border-t border-[#EBEBEA] pt-4">
              <p className="font-label text-[10px] uppercase tracking-wide text-[#A8A8A4]">Status</p>
              <div className="flex items-center justify-between gap-4">
                <span className="font-body text-sm text-charcoal">Approved</span>
                <Toggle checked={isApproved} srLabel="Approved" onChange={setIsApproved} />
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="font-body text-sm text-charcoal">Show on homepage</span>
                <Toggle
                  checked={showOnHomepage}
                  disabled={!isApproved}
                  srLabel="Show on homepage"
                  onChange={setShowOnHomepage}
                />
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-end gap-3 border-t border-[#EBEBEA] pt-4">
            <Dialog.Close className="px-4 py-2 font-body text-sm text-charcoal-mid hover:text-charcoal">
              Cancel
            </Dialog.Close>
            <button
              type="button"
              disabled={saving}
              onClick={() => void submit()}
              className="rounded-[3px] bg-choc px-5 py-2.5 font-label text-[11px] font-semibold uppercase tracking-wide text-cream disabled:opacity-50"
            >
              {saving ? "Saving…" : isEdit ? "Update Testimonial" : "Save Testimonial"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export { clientLabel };
