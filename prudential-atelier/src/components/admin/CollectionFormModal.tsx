"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { X } from "lucide-react";
import Image from "next/image";
import { collectionAdminSchema } from "@/validations/collection";
import type { z } from "zod";
import { slugifyText } from "@/lib/utils";
import { uploadAdminAsset } from "@/lib/admin-upload-xhr";
import { UploadProgressBar } from "@/components/admin/UploadProgressBar";
import type { AdminCollectionRow } from "@/components/admin/CollectionsClient";
import type { ProductListItem } from "@/types/product";
import { AlertDialog as ConfirmDialog } from "@/components/ui/AlertDialog";
import { formatUnpublishImpactMessage, type UnpublishImpact } from "@/lib/collection-unpublish-impact";

type FormValues = z.infer<typeof collectionAdminSchema>;

type ManualPreview = { id: string; name: string; thumb: string | null };

export function CollectionFormModal({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: AdminCollectionRow | null;
  onSaved: () => void;
}) {
  const isEdit = Boolean(editing);
  const [manualIds, setManualIds] = useState<string[]>([]);
  const [manualPreview, setManualPreview] = useState<Record<string, ManualPreview>>({});
  const [tagMatchCount, setTagMatchCount] = useState<number | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [searchHits, setSearchHits] = useState<ProductListItem[]>([]);
  const [seoOpen, setSeoOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [baselineManual, setBaselineManual] = useState<string[]>([]);
  const [editLoading, setEditLoading] = useState(false);
  const [unpublishMessage, setUnpublishMessage] = useState("");
  const [pendingPatch, setPendingPatch] = useState<Record<string, unknown> | null>(null);
  const [unpublishBusy, setUnpublishBusy] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(collectionAdminSchema),
    defaultValues: {
      name: "",
      slug: undefined,
      description: "",
      excerpt: "",
      coverImage: null,
      coverImageAlt: "",
      autoTag: null,
      isFeatured: false,
      isPublished: false,
      displayOrder: 0,
      season: null,
      year: null,
      metaTitle: "",
      metaDescription: "",
    },
  });

  const watchName = form.watch("name");
  const watchAutoTag = form.watch("autoTag");
  const watchCover = form.watch("coverImage");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setEditLoading(true);
      form.reset({
        name: editing.name,
        slug: editing.slug,
        description: "",
        excerpt: editing.excerpt ?? "",
        coverImage: editing.coverImage,
        coverImageAlt: "",
        autoTag: editing.autoTag,
        isFeatured: editing.isFeatured,
        isPublished: editing.isPublished,
        displayOrder: editing.displayOrder,
        season: editing.season,
        year: editing.year,
        metaTitle: "",
        metaDescription: "",
      });
      void (async () => {
        const res = await fetch(`/api/admin/collections/${editing.id}`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          collection: {
            description: string | null;
            coverImageAlt: string | null;
            metaTitle: string | null;
            metaDescription: string | null;
            manualAssignments: { productId: string; product: ProductListItem }[];
          };
        };
        const c = data.collection;
        form.setValue("description", c.description ?? "");
        form.setValue("coverImageAlt", c.coverImageAlt ?? "");
        form.setValue("metaTitle", c.metaTitle ?? "");
        form.setValue("metaDescription", c.metaDescription ?? "");
        const ids = c.manualAssignments.map((m) => m.productId);
        setManualIds(ids);
        setBaselineManual(ids);
        const prev: Record<string, ManualPreview> = {};
        for (const m of c.manualAssignments) {
          prev[m.productId] = {
            id: m.productId,
            name: m.product.name,
            thumb: m.product.images[0]?.url ?? null,
          };
        }
        setManualPreview(prev);
      })().finally(() => setEditLoading(false));
    } else {
      setEditLoading(false);
      form.reset({
        name: "",
        slug: undefined,
        description: "",
        excerpt: "",
        coverImage: null,
        coverImageAlt: "",
        autoTag: null,
        isFeatured: false,
        isPublished: false,
        displayOrder: 0,
        season: null,
        year: null,
        metaTitle: "",
        metaDescription: "",
      });
      setManualIds([]);
      setManualPreview({});
      setBaselineManual([]);
    }
  }, [open, editing, form]);

  useEffect(() => {
    const tag = (watchAutoTag ?? "").trim();
    if (!tag) {
      setTagMatchCount(null);
      return;
    }
    const t = window.setTimeout(() => {
      void (async () => {
        const res = await fetch(`/api/products?tags=${encodeURIComponent(tag)}&limit=1`);
        if (!res.ok) return;
        const data = (await res.json()) as { total: number };
        setTagMatchCount(data.total);
      })();
    }, 350);
    return () => window.clearTimeout(t);
  }, [watchAutoTag]);

  useEffect(() => {
    const q = searchQ.trim();
    if (q.length < 2) {
      setSearchHits([]);
      return;
    }
    const t = window.setTimeout(() => {
      void (async () => {
        const res = await fetch(`/api/products?search=${encodeURIComponent(q)}&limit=8`);
        if (!res.ok) return;
        const data = (await res.json()) as { products: ProductListItem[] };
        setSearchHits(data.products);
      })();
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchQ]);

  const watchSlugField = form.watch("slug");
  const slugPreview = useMemo(() => {
    const s = watchSlugField;
    if (s && String(s).trim()) return slugifyText(String(s));
    return watchName ? slugifyText(watchName) : "your-slug";
  }, [watchSlugField, watchName]);

  const onNameBlur = useCallback(() => {
    if (!isEdit && watchName.trim()) {
      form.setValue("slug", slugifyText(watchName));
    }
  }, [form, isEdit, watchName]);

  const addManual = (p: ProductListItem) => {
    if (manualIds.includes(p.id)) return;
    if (manualIds.length >= 100) {
      toast.error("Maximum 100 manual products");
      return;
    }
    setManualIds((prev) => [...prev, p.id]);
    setManualPreview((prev) => ({
      ...prev,
      [p.id]: { id: p.id, name: p.name, thumb: p.images[0]?.url ?? null },
    }));
    setSearchQ("");
    setSearchHits([]);
  };

  const removeManual = (id: string) => {
    setManualIds((prev) => prev.filter((x) => x !== id));
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      const url = await uploadAdminAsset(file, "prudential-atelier/collections", (p) => setUploadProgress(p));
      form.setValue("coverImage", url, { shouldValidate: true, shouldDirty: true });
      toast.success("Image uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      setUploadProgress(null);
      e.target.value = "";
    }
  };

  const syncManualProducts = async (collectionId: string, initialIds: string[]) => {
    const toAdd = manualIds.filter((id) => !initialIds.includes(id));
    const toRemove = initialIds.filter((id) => !manualIds.includes(id));
    for (const id of toRemove) {
      const res = await fetch(`/api/admin/collections/${collectionId}/products?productId=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("remove product failed");
    }
    for (const id of toAdd) {
      const res = await fetch(`/api/admin/collections/${collectionId}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: id }),
      });
      if (!res.ok) throw new Error("add product failed");
    }
  };

  const savePatch = async (collectionId: string, body: Record<string, unknown>, confirmed: boolean) => {
    const res = await fetch(`/api/admin/collections/${collectionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, confirmUnpublishProducts: confirmed || undefined }),
    });
    if (res.status === 409) {
      const err = (await res.json().catch(() => ({}))) as { impact?: UnpublishImpact };
      if (err.impact) {
        setPendingPatch(body);
        setUnpublishMessage(formatUnpublishImpactMessage(err.impact));
        return "confirm";
      }
    }
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(typeof err.error === "string" ? err.error : "Save failed");
      return "error";
    }
    await syncManualProducts(collectionId, baselineManual);
    toast.success("Collection saved ✓");
    onSaved();
    return "ok";
  };

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const body = {
        ...values,
        slug: values.slug?.trim() ? slugifyText(values.slug) : undefined,
        coverImage:
          values.coverImage === "" || values.coverImage === undefined ? null : values.coverImage,
      };
      if (isEdit && editing) {
        await savePatch(editing.id, body, false);
        return;
      }

      const res = await fetch("/api/admin/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(typeof err.error === "string" ? err.error : "Create failed");
        return;
      }
      const created = (await res.json()) as { id: string };
      for (const id of manualIds) {
        const pr = await fetch(`/api/admin/collections/${created.id}/products`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: id }),
        });
        if (!pr.ok) throw new Error("assign product failed");
      }
      toast.success("Collection saved ✓");
      onSaved();
    } catch {
      toast.error("Save failed");
    }
  });

  return (
    <>
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[101] flex max-h-[92vh] w-[700px] max-w-[96vw] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden border border-sand bg-bg-card shadow-xl">
          <div className="flex shrink-0 items-center justify-between border-b border-sand px-6 py-4">
            <Dialog.Title className="font-display text-xl text-ink">
              {isEdit ? `Edit: ${editing?.name ?? ""}` : "Create collection"}
            </Dialog.Title>
            <Dialog.Close className="text-[#6B6B68] hover:text-ink" aria-label="Close">
              <X size={20} />
            </Dialog.Close>
          </div>

          <form onSubmit={onSubmit} className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div className="grid gap-0 pb-4 md:grid-cols-[3fr_2fr]">
            <div className="space-y-6 border-b border-sand p-6 md:border-b-0 md:border-r">
              <div>
                <label className="font-body text-[11px] font-medium uppercase tracking-wide text-[#6B6B68]">
                  Collection name *
                </label>
                <input
                  {...form.register("name")}
                  onBlur={onNameBlur}
                  className="mt-1 w-full border border-sand px-3 py-2 text-[13px]"
                />
                {form.formState.errors.name ? (
                  <p className="mt-1 text-[11px] text-red-700">{form.formState.errors.name.message}</p>
                ) : null}
              </div>

              <div>
                <label className="font-body text-[11px] font-medium uppercase tracking-wide text-[#6B6B68]">
                  Slug
                </label>
                <input {...form.register("slug")} className="mt-1 w-full border border-sand px-3 py-2 font-mono text-[12px]" />
                <p className="mt-1 text-[11px] text-[#8A8A86]">prudentgabriel.com/collections/{slugPreview}</p>
                {form.formState.errors.slug ? (
                  <p className="mt-1 text-[11px] text-red-700">{form.formState.errors.slug.message}</p>
                ) : null}
              </div>

              <div>
                <label className="font-body text-[11px] font-medium uppercase tracking-wide text-[#6B6B68]">
                  Tagline / excerpt
                </label>
                <input {...form.register("excerpt")} maxLength={200} className="mt-1 w-full border border-sand px-3 py-2 text-[13px]" />
              </div>

              <div>
                <label className="font-body text-[11px] font-medium uppercase tracking-wide text-[#6B6B68]">
                  Description
                </label>
                <textarea {...form.register("description")} rows={4} maxLength={2000} className="mt-1 w-full border border-sand px-3 py-2 text-[13px]" />
              </div>

              <div className="flex flex-wrap gap-4">
                <div className="min-w-[100px] flex-1">
                  <label className="font-body text-[11px] font-medium uppercase tracking-wide text-[#6B6B68]">Season</label>
                  <input {...form.register("season")} maxLength={10} className="mt-1 w-full border border-sand px-3 py-2 text-[13px]" />
                </div>
                <div className="w-28">
                  <label className="font-body text-[11px] font-medium uppercase tracking-wide text-[#6B6B68]">Year</label>
                  <input
                    type="number"
                    {...form.register("year", {
                      setValueAs: (v) => {
                        if (v === "" || v === null || v === undefined) return null;
                        const n = Number(v);
                        return Number.isFinite(n) ? n : null;
                      },
                    })}
                    className="mt-1 w-full border border-sand px-3 py-2 text-[13px]"
                  />
                </div>
              </div>

              <div>
                <p className="font-body text-[11px] font-medium uppercase tracking-wide text-[#6B6B68]">Auto-tag</p>
                <input {...form.register("autoTag")} className="mt-1 w-full border border-sand px-3 py-2 text-[13px]" placeholder="e.g. rich-regal" />
                <p className="mt-1 text-[11px] text-[#8A8A86]">All products with this tag are automatically included.</p>
                {tagMatchCount !== null ? (
                  <p className="mt-1 font-body text-[12px] text-olive">Currently matches {tagMatchCount} published products</p>
                ) : null}
              </div>

              <div>
                <p className="font-body text-[11px] font-medium uppercase tracking-wide text-[#6B6B68]">Also include these products</p>
                <input
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  className="mt-1 w-full border border-sand px-3 py-2 text-[13px]"
                  placeholder="Search products…"
                />
                {searchHits.length > 0 ? (
                  <ul className="mt-2 max-h-48 overflow-auto border border-sand bg-[#FAFAFA]">
                    {searchHits.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => addManual(p)}
                          className="flex w-full items-center gap-2 px-2 py-2 text-left text-[12px] hover:bg-bg-card"
                        >
                          {p.images[0]?.url ? (
                            <span className="relative h-10 w-8 shrink-0 overflow-hidden bg-[#EEE]">
                              <Image src={p.images[0].url} alt="" fill className="object-cover" sizes="32px" />
                            </span>
                          ) : null}
                          <span>{p.name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  {manualIds.map((id) => {
                    const pr = manualPreview[id];
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 border border-sand bg-[#FAFAFA] px-2 py-1 text-[11px]"
                      >
                        {pr?.name ?? id}
                        <button type="button" className="text-red-700" onClick={() => removeManual(id)} aria-label="Remove">
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
                <p className="mt-2 text-[11px] text-[#8A8A86]">Manually added products appear before auto-tagged ones (max 100).</p>
              </div>
            </div>

            <div className="flex flex-col gap-6 p-6">
              <div>
                <p className="font-body text-[11px] font-medium uppercase tracking-wide text-[#6B6B68]">Cover image</p>
                <div className="relative mt-2 aspect-[3/4] w-full max-w-[220px] bg-[#F2F2F0]">
                  {watchCover ? (
                    <Image src={watchCover} alt="" fill className="object-cover" sizes="220px" />
                  ) : null}
                </div>
                <label className="mt-2 inline-block cursor-pointer border border-[#37392d] px-3 py-1.5 font-body text-[11px] uppercase tracking-wide text-[#37392d]">
                  {uploading ? "Uploading…" : "Upload image"}
                  <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp,.jpg,.jpeg,.png,.webp" className="hidden" onChange={onPickFile} />
                </label>
                <input
                  {...form.register("coverImage")}
                  className="mt-2 w-full border border-sand px-2 py-1 font-mono text-[11px]"
                  placeholder="Or paste image URL"
                />
                <input {...form.register("coverImageAlt")} className="mt-2 w-full border border-sand px-2 py-1 text-[12px]" placeholder="Alt text" />
                <p className="mt-1 text-[10px] text-[#8A8A86]">Portrait editorial (3:4) works best.</p>
                <div className="mt-2 max-w-[220px]">
                  <UploadProgressBar value={uploadProgress} />
                </div>
              </div>

              <div className="space-y-3 border-t border-sand pt-4">
                <label className="flex items-center gap-2 font-body text-[13px]">
                  <input type="checkbox" {...form.register("isPublished")} className="accent-olive" />
                  Published
                </label>
                <p className="font-body text-[11px] text-[#8A8A86]">
                  Leave unchecked until launch. Unpublishing asks you to confirm before hiding products,
                  including pieces that also sit in other collections.
                </p>
                <label className="flex items-center gap-2 font-body text-[13px]">
                  <input type="checkbox" {...form.register("isFeatured")} className="accent-olive" />
                  Featured on homepage
                </label>
                <div>
                  <label className="font-body text-[11px] uppercase text-[#6B6B68]">Display order</label>
                  <input
                    type="number"
                    {...form.register("displayOrder", {
                      setValueAs: (v) => {
                        if (v === "" || v === null || v === undefined) return 0;
                        const n = Number(v);
                        return Number.isFinite(n) ? n : 0;
                      },
                    })}
                    className="mt-1 w-full border border-sand px-2 py-1"
                  />
                </div>
              </div>

              <div className="border-t border-sand pt-4">
                <button
                  type="button"
                  onClick={() => setSeoOpen((v) => !v)}
                  className="font-body text-[11px] font-medium uppercase tracking-wide text-olive"
                >
                  SEO {seoOpen ? "−" : "+"}
                </button>
                {seoOpen ? (
                  <div className="mt-3 space-y-2">
                    <input {...form.register("metaTitle")} maxLength={60} className="w-full border border-sand px-2 py-1 text-[12px]" placeholder="Meta title" />
                    <textarea
                      {...form.register("metaDescription")}
                      maxLength={160}
                      rows={3}
                      className="max-h-40 min-h-[4.5rem] w-full resize-y border border-sand px-2 py-1 text-[12px]"
                      placeholder="Meta description"
                    />
                  </div>
                ) : null}
              </div>
            </div>
              </div>
            </div>

            <div className="relative z-20 flex shrink-0 justify-end gap-3 border-t border-sand bg-bg-card px-6 py-4">
              <Dialog.Close asChild>
                <button type="button" className="border border-sand px-4 py-2 font-body text-[12px]">
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={isEdit && editLoading}
                className="bg-[#37392d] px-5 py-2 font-body text-[12px] font-medium uppercase tracking-wide text-white disabled:opacity-50"
              >
                Save collection
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
    <ConfirmDialog
      open={pendingPatch !== null && Boolean(editing)}
      onOpenChange={(o) => {
        if (!o) {
          setPendingPatch(null);
          setUnpublishMessage("");
        }
      }}
      title="Unpublish this collection?"
      description={unpublishMessage}
      variant="warning"
      confirmLabel="Unpublish pieces"
      loading={unpublishBusy}
      onConfirm={async () => {
        if (!editing || !pendingPatch) return;
        setUnpublishBusy(true);
        try {
          const result = await savePatch(editing.id, pendingPatch, true);
          if (result === "ok") {
            setPendingPatch(null);
            setUnpublishMessage("");
          }
        } finally {
          setUnpublishBusy(false);
        }
      }}
    />
    </>
  );
}
