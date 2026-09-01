"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, Controller, type Resolver, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import slugify from "slugify";
import toast from "react-hot-toast";
import type { Product, ProductCategory, ProductColor, ProductImage, ProductVariant } from "@prisma/client";
import type { ProductListItem } from "@/types/product";
import { ProductCategory as PC, ProductType as PT } from "@prisma/client";
import { productAdminSchema, type ProductAdminInput } from "@/validations/product";
import { VariantManager } from "./VariantManager";
import { buildDefaultProductSku } from "@/lib/product-sku";
import { getPublicAppUrl } from "@/lib/app-url";
import { cn } from "@/lib/utils";
import { uploadAdminAsset } from "@/lib/admin-upload-xhr";
import { UploadProgressBar } from "@/components/admin/UploadProgressBar";
import { saleFigureIsDormant } from "@/lib/pricing";
import { isLegacyWordPressImageUrl } from "@/lib/product-image-url";

type FullProduct = Product & {
  images: ProductImage[];
  variants: ProductVariant[];
  colors: ProductColor[];
  bundleItems: { targetProductId: string; targetProduct?: { name: string } }[];
  measurementFields?: { fieldId: string; required: boolean; sortOrder: number }[];
};

const CATEGORY_OPTIONS: ProductCategory[] = [
  PC.BRIDAL,
  PC.EVENING_WEAR,
  PC.CASUAL,
  PC.FORMAL,
  PC.KIDDIES,
  PC.ACCESSORIES,
];

function mapProductToForm(p: FullProduct): ProductAdminInput {
  const slug = p.slug;
  return {
    name: p.name,
    slug: p.slug,
    description: p.description,
    details: p.details ?? "",
    category: p.category,
    type: p.type,
    tags: p.tags ?? [],
    basePriceNGN: p.basePriceNGN,
    basePriceUSD: p.priceUSD ?? undefined,
    basePriceGBP: p.priceGBP ?? undefined,
    isOnSale: p.isOnSale,
    saleEndsAt: p.saleEndsAt,
    isPublished: p.isPublished,
    isFeatured: p.isFeatured,
    isNewArrival: p.isNewArrival,
    isBespokeAvail: p.isBespokeAvail,
    customOffered: p.customOffered,
    customSurchargeKind: p.customSurchargeKind,
    customSurchargeValue: p.customSurchargeValue ?? undefined,
    customLeadTimeDays: p.customLeadTimeDays ?? undefined,
    customReturnable: p.customReturnable,
    measurementFieldIds: (p.measurementFields ?? []).map((m) => ({
      fieldId: m.fieldId,
      required: m.required,
      sortOrder: m.sortOrder,
    })),
    defaultWeightKg: p.defaultWeightKg ?? undefined,
    defaultLengthCm: p.defaultLengthCm ?? undefined,
    defaultWidthCm: p.defaultWidthCm ?? undefined,
    defaultHeightCm: p.defaultHeightCm ?? undefined,
    metaTitle: p.metaTitle ?? undefined,
    metaDescription: p.metaDescription ?? undefined,
    variants: p.variants.map((v, i) => ({
      id: v.id,
      size: v.size,
      sku: (v.sku ?? buildDefaultProductSku(slug, v.size)).trim() || buildDefaultProductSku(slug, v.size),
      priceNGN: v.priceNGN,
      priceUSD: v.priceUSD ?? undefined,
      priceGBP: v.priceGBP ?? undefined,
      salePriceNGN: v.salePriceNGN,
      stock: v.stock,
      lowStockAt: v.lowStockAt,
      sortOrder: v.sortOrder ?? i,
      weightKg: v.weightKg ?? undefined,
      lengthCm: v.lengthCm ?? undefined,
      widthCm: v.widthCm ?? undefined,
      heightCm: v.heightCm ?? undefined,
    })),
    colors: p.colors.map((c) => ({
      id: c.id,
      name: c.name,
      hex: c.hex.length === 7 ? c.hex : `#${c.hex.replace(/^#/, "")}`,
      imageUrl: c.imageUrl,
    })),
    images: p.images.map((im, i) => ({
      id: im.id,
      url: im.url,
      alt: im.alt ?? "",
      isPrimary: im.isPrimary,
      sortOrder: im.sortOrder ?? i,
    })),
    bundleProductIds: p.bundleItems.map((b) => b.targetProductId),
  };
}

const defaultCreate = (custom?: {
  offeredDefault: boolean;
  surchargeKind: "NONE" | "PERCENT" | "FLAT";
  surchargeValue: number;
  leadTimeDays: number;
  returnable: boolean;
}): ProductAdminInput => ({
  name: "",
  slug: "",
  description: "",
  details: "",
  category: PC.BRIDAL,
  type: PT.RTW,
  tags: [],
  basePriceNGN: 1000,
  basePriceUSD: undefined,
  basePriceGBP: undefined,
  isOnSale: false,
  saleEndsAt: null,
  isPublished: false,
  isFeatured: false,
  isNewArrival: false,
    isBespokeAvail: false,
    customOffered: custom?.offeredDefault ?? false,
    customSurchargeKind: custom?.surchargeKind === "NONE" ? null : (custom?.surchargeKind ?? null),
    customSurchargeValue: custom?.surchargeKind && custom.surchargeKind !== "NONE" ? custom.surchargeValue : undefined,
    customLeadTimeDays: custom?.leadTimeDays,
    customReturnable: custom?.returnable ?? false,
    measurementFieldIds: [],
  defaultWeightKg: undefined,
  defaultLengthCm: undefined,
  defaultWidthCm: undefined,
  defaultHeightCm: undefined,
  metaTitle: undefined,
  metaDescription: undefined,
  variants: [
    {
      size: "S",
      sku: "PA-ITEM-S",
      priceNGN: 1000,
      stock: 0,
      lowStockAt: 3,
      sortOrder: 0,
    },
  ],
  colors: [],
  images: [],
  bundleProductIds: [],
});

export function ProductFormPage({
  product,
  customDefaults,
}: {
  product?: FullProduct;
  customDefaults?: {
    offeredDefault: boolean;
    surchargeKind: "NONE" | "PERCENT" | "FLAT";
    leadTimeDays: number;
    surchargeValue: number;
    returnable: boolean;
  };
}) {
  const router = useRouter();
  const mode = product ? "edit" : "create";
  const defaults = useMemo(
    () => (product ? mapProductToForm(product) : defaultCreate(customDefaults)),
    [product, customDefaults],
  );

  const form = useForm<ProductAdminInput>({
    resolver: zodResolver(productAdminSchema) as Resolver<ProductAdminInput>,
    defaultValues: defaults,
  });

  const { fields: colorFields, append: appendColor, remove: removeColor } = useFieldArray({
    control: form.control,
    name: "colors",
  });

  const [libraryFields, setLibraryFields] = useState<{ id: string; key: string; label: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [reuploadingId, setReuploadingId] = useState<string | null>(null);
  const [bundleSearch, setBundleSearch] = useState("");
  const [bundleResults, setBundleResults] = useState<ProductListItem[]>([]);
  const [bundleSearching, setBundleSearching] = useState(false);
  const slugWatch = form.watch("slug");
  const nameWatch = form.watch("name");
  const basePriceWatch = form.watch("basePriceNGN");
  const isOnSaleWatch = form.watch("isOnSale");
  const variantsWatch = form.watch("variants");
  const bundleIds = form.watch("bundleProductIds");
  const customOfferedWatch = form.watch("customOffered");
  const measurementIds = form.watch("measurementFieldIds") ?? [];

  useEffect(() => {
    void fetch("/api/admin/measurement-fields")
      .then((r) => r.json())
      .then((j: { items?: { id: string; key: string; label: string }[] }) => setLibraryFields(j.items ?? []))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (bundleSearch.trim().length < 2) {
      setBundleResults([]);
      return;
    }
    const t = setTimeout(() => {
      setBundleSearching(true);
      void fetch(`/api/products?search=${encodeURIComponent(bundleSearch.trim())}&limit=8&isPublished=true`)
        .then((r) => r.json())
        .then((j: { products?: ProductListItem[] }) => {
          const list = j.products ?? [];
          setBundleResults(list.filter((p) => p.id !== product?.id));
        })
        .catch(() => setBundleResults([]))
        .finally(() => setBundleSearching(false));
    }, 400);
    return () => clearTimeout(t);
  }, [bundleSearch, product?.id]);

  const bundleMeta = useCallback(
    (id: string) => {
      const fromForm = product?.bundleItems.find((b) => b.targetProductId === id);
      if (fromForm?.targetProduct) {
        return { name: fromForm.targetProduct.name, thumb: null as string | null };
      }
      const hit = bundleResults.find((p) => p.id === id);
      const img = hit?.images.find((i) => i.isPrimary) ?? hit?.images[0];
      return { name: hit?.name ?? id.slice(0, 8), thumb: img?.url ?? null };
    },
    [product?.bundleItems, bundleResults],
  );

  const addBundle = (p: ProductListItem) => {
    const cur = form.getValues("bundleProductIds");
    if (cur.includes(p.id) || cur.length >= 4) return;
    form.setValue("bundleProductIds", [...cur, p.id]);
    setBundleSearch("");
    setBundleResults([]);
  };

  const removeBundle = (id: string) => {
    form.setValue(
      "bundleProductIds",
      form.getValues("bundleProductIds").filter((x) => x !== id),
    );
  };

  const onBlurName = () => {
    const slugVal = form.getValues("slug");
    if (!slugVal && nameWatch) {
      form.setValue("slug", slugify(nameWatch, { lower: true, strict: true }));
    }
  };

  const persistImage = async (url: string, isPrimary: boolean, sortOrder: number) => {
    if (mode !== "edit" || !product?.id) {
      return { url, alt: "", isPrimary, sortOrder };
    }
    const res = await fetch(`/api/admin/products/${product.id}/images`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, alt: "", isPrimary, sortOrder }),
    });
    const data = (await res.json()) as ProductImage & { error?: string };
    if (!res.ok) {
      throw new Error(typeof data.error === "string" ? data.error : "Could not save image");
    }
    return {
      id: data.id,
      url: data.url,
      alt: data.alt ?? "",
      isPrimary: data.isPrimary,
      sortOrder: data.sortOrder,
    };
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      const list = Array.from(files);
      let done = 0;
      for (const file of list) {
        const url = await uploadAdminAsset(file, "prudential-atelier/products", (p) => {
          const slice = 100 / list.length;
          setUploadProgress(Math.round(done * slice + (p / 100) * slice));
        });
        const imgs = form.getValues("images");
        const isFirst = imgs.length === 0;
        const saved = await persistImage(url, isFirst, imgs.length);
        form.setValue("images", [...imgs, saved]);
        done += 1;
        setUploadProgress(Math.round((100 * done) / list.length));
      }
      toast.success("Images uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const setPrimary = (index: number) => {
    const imgs = form.getValues("images").map((im, i) => ({ ...im, isPrimary: i === index }));
    form.setValue("images", imgs);
  };

  const removeImage = async (index: number) => {
    const imgs = form.getValues("images");
    const target = imgs[index];
    if (!target) return;

    const next = imgs.filter((_, i) => i !== index);
    if (next.length && !next.some((i) => i.isPrimary)) {
      next[0] = { ...next[0], isPrimary: true };
    }
    form.setValue("images", next);

    if (mode === "edit" && product?.id && target.id) {
      try {
        const res = await fetch(`/api/admin/products/${product.id}/images/${target.id}`, {
          method: "DELETE",
          credentials: "include",
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          throw new Error(typeof data.error === "string" ? data.error : "Could not delete image");
        }
        toast.success("Image removed");
        router.refresh();
      } catch (e) {
        form.setValue("images", imgs);
        toast.error(e instanceof Error ? e.message : "Delete failed");
      }
    }
  };

  const reuploadLegacyImage = async (index: number) => {
    const imgs = form.getValues("images");
    const target = imgs[index];
    if (!target?.id || mode !== "edit" || !product?.id) return;

    setReuploadingId(target.id);
    try {
      const res = await fetch(`/api/admin/products/${product.id}/images/reupload`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUrl: target.url, imageId: target.id }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(typeof data.error === "string" ? data.error : "Re-upload failed");
      }
      const updated = imgs.map((im, i) => (i === index ? { ...im, url: data.url! } : im));
      form.setValue("images", updated);
      toast.success("Image migrated to Cloudinary");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Re-upload failed");
    } finally {
      setReuploadingId(null);
    }
  };

  const onSubmit: SubmitHandler<ProductAdminInput> = async (values) => {
    try {
      if (mode === "create") {
        const res = await fetch("/api/admin/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });
        const data = (await res.json()) as { id?: string; error?: unknown };
        if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not create");
        toast.success("Product created ✓");
        router.push(`/admin/products/${data.id}/edit`);
        router.refresh();
        return;
      }
      const res = await fetch(`/api/admin/products/${product!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await res.json()) as { error?: unknown };
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not save");
      toast.success("Changes saved ✓");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  const submit = form.handleSubmit(onSubmit);

  const saveDraft = () => {
    form.setValue("isPublished", false);
    queueMicrotask(() => void submit());
  };

  const publish = () => {
    form.setValue("isPublished", true);
    queueMicrotask(() => void submit());
  };

  const images = form.watch("images");

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/products" className="text-sm text-[#A8A8A4] hover:text-gold">
            ← Products
          </Link>
          <h1 className="mt-2 font-display text-2xl text-charcoal">
            {mode === "create" ? "Add new product" : `Edit: ${product?.name}`}
          </h1>
          <Link href="/admin/products/guide" className="mt-1 inline-block text-xs text-gold hover:underline">
            How to fill this page
          </Link>
        </div>
        <div className="flex gap-2">
          {mode === "edit" && product?.id ? (
            <button
              type="button"
              onClick={() => {
                void fetch(`/api/admin/products/${product.id}/duplicate`, { method: "POST" })
                  .then(async (r) => {
                    const j = (await r.json()) as { id?: string; error?: string };
                    if (!r.ok || !j.id) throw new Error(j.error ?? "Duplicate failed");
                    toast.success("Unpublished copy created");
                    router.push(`/admin/products/${j.id}/edit`);
                  })
                  .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Duplicate failed"));
              }}
              className="rounded-sm border border-sand px-4 py-2 text-sm text-gold hover:bg-gold/10"
            >
              Duplicate
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void saveDraft()}
            className="rounded-sm border border-sand px-4 py-2 text-sm text-gold hover:bg-gold/10"
          >
            Save draft
          </button>
          <button
            type="button"
            onClick={() => void publish()}
            className="rounded-sm bg-wine px-4 py-2 text-sm text-gold hover:bg-wine-hover"
          >
            Publish
          </button>
        </div>
      </div>

      <form onSubmit={submit} className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-sm border border-sand bg-canvas p-6">
            <h2 className="font-display text-lg text-gold">Basic information</h2>
            <label className="mt-4 block text-xs uppercase tracking-wide text-[#A8A8A4]">
              Product name
              <input
                {...form.register("name", { onBlur: onBlurName })}
                className="mt-1 w-full rounded-sm border border-sand bg-canvas px-3 py-2 text-charcoal"
              />
            </label>
            {form.formState.errors.name && (
              <p className="mt-1 text-xs text-red-400">{form.formState.errors.name.message}</p>
            )}
            <label className="mt-4 block text-xs uppercase tracking-wide text-[#A8A8A4]">
              Slug
              <input
                {...form.register("slug")}
                className="mt-1 w-full rounded-sm border border-sand bg-canvas px-3 py-2 font-mono text-sm text-charcoal"
              />
            </label>
            <p className="mt-1 text-xs text-gold/80">
              {getPublicAppUrl().replace(/^https?:\/\//, "")}/shop/{slugWatch || "[slug]"}
            </p>
            <label className="mt-4 block text-xs uppercase tracking-wide text-[#A8A8A4]">
              Short description (max 200)
              <textarea
                {...form.register("description")}
                maxLength={200}
                rows={3}
                className="mt-1 w-full rounded-sm border border-sand bg-canvas px-3 py-2 text-charcoal"
              />
            </label>
            <label className="mt-4 block text-xs uppercase tracking-wide text-[#A8A8A4]">
              Full description
              <textarea
                {...form.register("details")}
                rows={8}
                className="mt-1 w-full rounded-sm border border-sand bg-canvas px-3 py-2 text-charcoal"
              />
            </label>
            <label className="mt-4 block text-xs uppercase tracking-wide text-[#A8A8A4]">
              Materials &amp; care
              <textarea
                {...form.register("details")}
                rows={6}
                className="mt-1 w-full rounded-sm border border-sand bg-canvas px-3 py-2 text-charcoal"
              />
            </label>
          </section>

          <section className="rounded-sm border border-sand bg-canvas p-6">
            <h2 className="font-display text-lg text-gold">Media</h2>
            <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-sm border-2 border-dashed border-sand px-6 py-10 text-sm text-[#A8A8A4] hover:border-[#F5F5F3]0">
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                disabled={uploading}
                onChange={(e) => void uploadFiles(e.target.files)}
              />
              {uploading ? "Uploading…" : "Drop images here or click to upload"}
            </label>
            <div className="mt-2 max-w-md">
              <UploadProgressBar value={uploadProgress} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {images.map((im, idx) => (
                <div key={im.id ?? `${im.url}-${idx}`} className="relative rounded-sm border border-sand p-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={im.url} alt="" className="h-28 w-full rounded-sm object-cover" />
                  {isLegacyWordPressImageUrl(im.url) && (
                    <div className="mt-1 space-y-1">
                      <p className="text-[10px] text-amber-600">⚠ Hosted on old server</p>
                      {mode === "edit" && im.id && (
                        <button
                          type="button"
                          disabled={reuploadingId === im.id}
                          onClick={() => void reuploadLegacyImage(idx)}
                          className="text-[10px] text-gold hover:underline disabled:opacity-50"
                        >
                          {reuploadingId === im.id ? "Migrating…" : "Re-upload to Cloudinary →"}
                        </button>
                      )}
                    </div>
                  )}
                  <div className="mt-1 flex justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => setPrimary(idx)}
                      className={cn(
                        "text-xs",
                        im.isPrimary ? "text-gold" : "text-[#A8A8A4]",
                      )}
                    >
                      {im.isPrimary ? "★ Primary" : "☆ Set primary"}
                    </button>
                    <button
                      type="button"
                      className="text-xs text-red-400"
                      onClick={() => void removeImage(idx)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-sm border border-sand bg-canvas p-6">
            <h2 className="font-display text-lg text-gold">Variants &amp; pricing</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <label className="text-xs uppercase text-[#A8A8A4]">
                Starting ₦ for new sizes
                <input
                  type="number"
                  {...form.register("basePriceNGN", { valueAsNumber: true })}
                  className="mt-1 w-full rounded-sm border border-sand bg-canvas px-3 py-2 text-charcoal"
                />
              </label>
              <label className="text-xs uppercase text-[#A8A8A4]">
                Base $
                <input
                  type="number"
                  step="any"
                  {...form.register("basePriceUSD")}
                  className="mt-1 w-full rounded-sm border border-sand bg-canvas px-3 py-2 text-charcoal"
                />
              </label>
              <label className="text-xs uppercase text-[#A8A8A4]">
                Base £
                <input
                  type="number"
                  step="any"
                  {...form.register("basePriceGBP")}
                  className="mt-1 w-full rounded-sm border border-sand bg-canvas px-3 py-2 text-charcoal"
                />
              </label>
            </div>
            <p className="mt-2 text-xs text-[#A8A8A4]">
              Shop filter, cards, and emails use the cheapest size. Starting ₦ only seeds new rows and “copy onto every size”. Leave USD/GBP blank to convert from ₦; a figure here is the selling price in that currency and ignores the feed. Per-size $ / £ on the rows below win over this product figure.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-4">
              <label className="text-xs uppercase text-[#A8A8A4]">
                Default kg
                <input
                  type="number"
                  step="0.01"
                  {...form.register("defaultWeightKg")}
                  className="mt-1 w-full rounded-sm border border-sand bg-canvas px-3 py-2 text-charcoal"
                />
              </label>
              <label className="text-xs uppercase text-[#A8A8A4]">
                L cm
                <input
                  type="number"
                  step="0.1"
                  {...form.register("defaultLengthCm")}
                  className="mt-1 w-full rounded-sm border border-sand bg-canvas px-3 py-2 text-charcoal"
                />
              </label>
              <label className="text-xs uppercase text-[#A8A8A4]">
                W cm
                <input
                  type="number"
                  step="0.1"
                  {...form.register("defaultWidthCm")}
                  className="mt-1 w-full rounded-sm border border-sand bg-canvas px-3 py-2 text-charcoal"
                />
              </label>
              <label className="text-xs uppercase text-[#A8A8A4]">
                H cm
                <input
                  type="number"
                  step="0.1"
                  {...form.register("defaultHeightCm")}
                  className="mt-1 w-full rounded-sm border border-sand bg-canvas px-3 py-2 text-charcoal"
                />
              </label>
            </div>
            <p className="mt-2 text-xs text-[#A8A8A4]">Used when a size has no parcel of its own. Carriers bill the greater of actual and volumetric weight.</p>
            <div className="mt-4 flex items-center gap-3">
              <Controller
                control={form.control}
                name="isOnSale"
                render={({ field }) => (
                  <label className="flex items-center gap-2 text-sm text-charcoal">
                    <input type="checkbox" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />
                    Product is on sale
                  </label>
                )}
              />
            </div>
            {saleFigureIsDormant(Boolean(isOnSaleWatch), variantsWatch ?? []) ? (
              <p className="mt-3 text-xs text-amber-800">
                A sale ₦ is filled on at least one size, but “Product is on sale” is off. Shoppers see and pay the regular ₦ until you tick the flag (or clear the sale ₦).
              </p>
            ) : null}
            <Controller
              control={form.control}
              name="variants"
              render={({ field }) => (
                <VariantManager
                  slug={slugWatch || "item"}
                  variants={field.value}
                  onChange={field.onChange}
                  basePriceNGN={basePriceWatch}
                />
              )}
            />
            {form.formState.errors.variants && (
              <p className="mt-2 text-xs text-red-400">Check variant rows (size, price, stock).</p>
            )}
          </section>

          <section className="rounded-sm border border-sand bg-canvas p-6">
            <h2 className="font-display text-lg text-gold">Colours</h2>
            <button
              type="button"
              className="mt-3 rounded-sm border border-sand px-3 py-1 text-xs text-gold"
              onClick={() => appendColor({ name: "New", hex: "#000000", imageUrl: null })}
            >
              + Add colour
            </button>
            <div className="mt-4 space-y-3">
              {colorFields.map((field, i) => (
                <div key={field.id} className="flex flex-wrap items-end gap-2">
                  <input
                    {...form.register(`colors.${i}.name`)}
                    className="min-w-[100px] flex-1 rounded-sm border border-sand bg-canvas px-2 py-1 text-sm text-charcoal"
                    placeholder="Name"
                  />
                  <input type="color" {...form.register(`colors.${i}.hex`)} className="h-9 w-12 cursor-pointer bg-transparent" />
                  <input
                    {...form.register(`colors.${i}.imageUrl`)}
                    className="min-w-[160px] flex-1 rounded-sm border border-sand bg-canvas px-2 py-1 text-xs text-charcoal"
                    placeholder="Image URL (optional)"
                  />
                  <button type="button" className="text-red-400" onClick={() => removeColor(i)}>
                    ×
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-sm border border-sand bg-canvas p-6">
            <h2 className="font-display text-lg text-gold">Complete the Look</h2>
            <p className="mt-2 text-xs text-[#A8A8A4]">Link up to 4 published pieces shoppers may add alongside this product.</p>
            <div className="relative mt-4">
              <input
                value={bundleSearch}
                onChange={(e) => setBundleSearch(e.target.value)}
                disabled={bundleIds.length >= 4}
                placeholder={bundleIds.length >= 4 ? "Maximum 4 products" : "Search published products…"}
                className="w-full rounded-sm border border-sand bg-canvas px-3 py-2 text-sm text-charcoal placeholder:text-[#A8A8A4] disabled:opacity-50"
              />
              {bundleSearch.trim().length >= 2 && bundleIds.length < 4 ? (
                <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-sm border border-[#E8E8E4] bg-[#FAFAFA] py-1 shadow-lg">
                  {bundleSearching ? (
                    <p className="px-3 py-2 text-xs text-[#A8A8A4]">Searching…</p>
                  ) : bundleResults.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-[#A8A8A4]">No matches</p>
                  ) : (
                    bundleResults.map((p) => {
                      const img = p.images.find((i) => i.isPrimary) ?? p.images[0];
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => addBundle(p)}
                          disabled={bundleIds.includes(p.id)}
                          className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:border border-sand bg-canvas disabled:opacity-40"
                        >
                          <div className="relative h-12 w-9 shrink-0 overflow-hidden rounded-sm border border-sand bg-canvas">
                            {img?.url ? <Image src={img.url} alt="" fill className="object-cover" sizes="36px" /> : null}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-charcoal">{p.name}</div>
                            <div className="text-[11px] text-gold/80">{p.category.replace(/_/g, " ")}</div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              ) : null}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {bundleIds.map((bid) => {
                const meta = bundleMeta(bid);
                return (
                  <span
                    key={bid}
                    className="inline-flex items-center gap-2 rounded-full border border-[#E8E8E4] border border-sand bg-canvas py-1 pl-1 pr-2 text-xs text-charcoal"
                  >
                    {meta.thumb ? (
                      <span className="relative h-8 w-6 shrink-0 overflow-hidden rounded-sm">
                        <Image src={meta.thumb} alt="" fill className="object-cover" sizes="24px" />
                      </span>
                    ) : null}
                    <span className="max-w-[140px] truncate">{meta.name}</span>
                    <button type="button" className="text-red-400 hover:underline" onClick={() => removeBundle(bid)} aria-label={`Remove ${meta.name}`}>
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          </section>

          <section className="rounded-sm border border-sand bg-canvas p-6">
            <h2 className="font-display text-lg text-gold">SEO</h2>
            <label className="mt-3 block text-xs uppercase text-[#A8A8A4]">
              Meta title
              <input {...form.register("metaTitle")} maxLength={60} className="mt-1 w-full rounded-sm border border-sand bg-canvas px-3 py-2 text-charcoal" />
            </label>
            <label className="mt-3 block text-xs uppercase text-[#A8A8A4]">
              Meta description
              <textarea
                {...form.register("metaDescription")}
                maxLength={160}
                rows={3}
                className="mt-1 w-full rounded-sm border border-sand bg-canvas px-3 py-2 text-charcoal"
              />
            </label>
          </section>
        </div>

        <div className="space-y-6">
          <section className="sticky top-6 rounded-sm border border-sand bg-canvas p-6">
            <h2 className="font-display text-lg text-gold">Status</h2>
            <div className="mt-4 space-y-3 text-sm text-charcoal">
              <Controller
                control={form.control}
                name="isPublished"
                render={({ field }) => (
                  <label className="flex justify-between gap-2">
                    Published
                    <input type="checkbox" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />
                  </label>
                )}
              />
              <p className="text-[11px] text-[#A8A8A4]">Off until you click Publish. Saves as a draft.</p>
              <Controller
                control={form.control}
                name="isFeatured"
                render={({ field }) => (
                  <label className="flex justify-between gap-2">
                    Featured
                    <input type="checkbox" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />
                  </label>
                )}
              />
              <Controller
                control={form.control}
                name="isNewArrival"
                render={({ field }) => (
                  <label className="flex justify-between gap-2">
                    New arrival
                    <input type="checkbox" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />
                  </label>
                )}
              />
              <Controller
                control={form.control}
                name="isBespokeAvail"
                render={({ field }) => (
                  <label className="flex justify-between gap-2">
                    Bespoke available
                    <input type="checkbox" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />
                  </label>
                )}
              />
            </div>
            {product && (
              <p className="mt-4 text-xs text-[#A8A8A4]">
                Updated {new Date(product.updatedAt).toLocaleString()}
              </p>
            )}
          </section>

          <section className="rounded-sm border border-sand bg-canvas p-6">
            <h2 className="font-display text-lg text-gold">Custom measurements</h2>
            <p className="mt-1 text-xs text-[#A8A8A4]">
              Made to order. Does not take stock. Stay available when sizes sell out.
            </p>
            <Controller
              control={form.control}
              name="customOffered"
              render={({ field }) => (
                <label className="mt-3 flex justify-between gap-2 text-sm text-charcoal">
                  Offer custom on this piece
                  <input type="checkbox" checked={Boolean(field.value)} onChange={(e) => field.onChange(e.target.checked)} />
                </label>
              )}
            />
            {customOfferedWatch ? (
              <div className="mt-4 space-y-3 text-sm text-charcoal">
                <label className="block text-xs uppercase text-[#A8A8A4]">
                  Surcharge
                  <select
                    {...form.register("customSurchargeKind")}
                    className="mt-1 w-full rounded-sm border border-sand bg-canvas px-3 py-2 text-charcoal"
                  >
                    <option value="">Use store default</option>
                    <option value="NONE">None</option>
                    <option value="PERCENT">Percent</option>
                    <option value="FLAT">Flat ₦</option>
                  </select>
                </label>
                <label className="block text-xs uppercase text-[#A8A8A4]">
                  Surcharge value
                  <input
                    type="number"
                    step="0.01"
                    {...form.register("customSurchargeValue")}
                    className="mt-1 w-full rounded-sm border border-sand bg-canvas px-3 py-2 text-charcoal"
                  />
                </label>
                <label className="block text-xs uppercase text-[#A8A8A4]">
                  Lead time (days)
                  <input
                    type="number"
                    {...form.register("customLeadTimeDays")}
                    className="mt-1 w-full rounded-sm border border-sand bg-canvas px-3 py-2 text-charcoal"
                    placeholder="Store default"
                  />
                </label>
                <Controller
                  control={form.control}
                  name="customReturnable"
                  render={({ field }) => (
                    <label className="flex justify-between gap-2">
                      Returnable
                      <input
                        type="checkbox"
                        checked={Boolean(field.value)}
                        onChange={(e) => field.onChange(e.target.checked)}
                      />
                    </label>
                  )}
                />
                <p className="text-[11px] text-[#A8A8A4]">Leave returnable off. A custom garment cannot be worn by anyone else.</p>
                <p className="text-xs uppercase text-[#A8A8A4]">Fields for this piece</p>
                <ul className="space-y-2">
                  {libraryFields.map((f) => {
                    const selected = measurementIds.find((m) => m.fieldId === f.id);
                    return (
                      <li key={f.id} className="flex items-center justify-between gap-2">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={Boolean(selected)}
                            onChange={(e) => {
                              const cur = form.getValues("measurementFieldIds") ?? [];
                              if (e.target.checked) {
                                form.setValue("measurementFieldIds", [
                                  ...cur,
                                  { fieldId: f.id, required: true, sortOrder: cur.length },
                                ]);
                              } else {
                                form.setValue(
                                  "measurementFieldIds",
                                  cur.filter((m) => m.fieldId !== f.id),
                                );
                              }
                            }}
                          />
                          {f.label}
                        </label>
                        {selected ? (
                          <label className="flex items-center gap-1 text-xs">
                            Required
                            <input
                              type="checkbox"
                              checked={selected.required}
                              onChange={(e) => {
                                const cur = form.getValues("measurementFieldIds") ?? [];
                                form.setValue(
                                  "measurementFieldIds",
                                  cur.map((m) => (m.fieldId === f.id ? { ...m, required: e.target.checked } : m)),
                                );
                              }}
                            />
                          </label>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </section>

          <section className="rounded-sm border border-sand bg-canvas p-6">
            <h2 className="font-display text-lg text-gold">Organisation</h2>
            <label className="mt-3 block text-xs uppercase text-[#A8A8A4]">
              Category
              <select {...form.register("category")} className="mt-1 w-full rounded-sm border border-sand bg-canvas px-3 py-2 text-charcoal">
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="mt-4 text-sm text-charcoal">
              <legend className="text-xs uppercase text-[#A8A8A4]">Product type</legend>
              <label className="mr-4 mt-2 inline-flex items-center gap-2">
                <input type="radio" value={PT.RTW} {...form.register("type")} />
                RTW
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="radio" value={PT.BESPOKE} {...form.register("type")} />
                Bespoke
              </label>
            </fieldset>
            <label className="mt-4 block text-xs uppercase text-[#A8A8A4]">
              Tags (comma-separated)
              <input
                className="mt-1 w-full rounded-sm border border-sand bg-canvas px-3 py-2 text-charcoal"
                defaultValue={defaults.tags.join(", ")}
                onBlur={(e) =>
                  form.setValue(
                    "tags",
                    e.target.value
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean),
                  )
                }
              />
            </label>
          </section>
        </div>
      </form>
    </div>
  );
}
