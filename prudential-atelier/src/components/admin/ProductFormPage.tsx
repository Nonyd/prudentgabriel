"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { buildDefaultProductSku, isGeneratedProductSku } from "@/lib/product-sku";
import { getPublicAppUrl } from "@/lib/app-url";
import { cn } from "@/lib/utils";
import { uploadAdminAsset } from "@/lib/admin-upload-xhr";
import { UploadProgressBar } from "@/components/admin/UploadProgressBar";
import { saleFigureIsDormant } from "@/lib/pricing";
import { isLegacyWordPressImageUrl } from "@/lib/product-image-url";
import { ProductWizardRail } from "./ProductWizardRail";
import {
  PRODUCT_WIZARD_STEPS,
  categoryNeedsSizes,
  clearWizardDraft,
  draftBlockedMessage,
  productFormLayout,
  publishBlockedMessage,
  readWizardDraft,
  rekeyWizardDraft,
  writeWizardDraft,
  type ProductFormLayout,
} from "@/lib/product-wizard";

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

const STEPS = PRODUCT_WIZARD_STEPS;

function Req() {
  return <span className="ml-1 font-normal normal-case tracking-normal text-wine">Required</span>;
}

function Opt() {
  return <span className="ml-1 font-normal normal-case tracking-normal text-[#A8A8A4]">Optional</span>;
}

function mapProductToForm(p: FullProduct): ProductAdminInput {
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
    customOfferedWhenSoldOut: p.customOfferedWhenSoldOut,
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
      sku: v.sku ?? "",
      skuManual: v.skuManual,
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
    regenerateSkus: false,
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
  basePriceNGN: 0,
  basePriceUSD: undefined,
  basePriceGBP: undefined,
  isOnSale: false,
  saleEndsAt: null,
  isPublished: false,
  isFeatured: false,
  isNewArrival: false,
  isBespokeAvail: false,
  customOffered: custom?.offeredDefault ?? false,
  customOfferedWhenSoldOut: false,
  customSurchargeKind: custom?.surchargeKind === "NONE" ? null : (custom?.surchargeKind ?? null),
  customSurchargeValue: custom?.surchargeKind && custom.surchargeKind !== "NONE" ? custom.surchargeValue : undefined,
  customLeadTimeDays: undefined,
  customReturnable: custom?.returnable ?? false,
  measurementFieldIds: [],
  defaultWeightKg: undefined,
  defaultLengthCm: undefined,
  defaultWidthCm: undefined,
  defaultHeightCm: undefined,
  metaTitle: undefined,
  metaDescription: undefined,
  variants: [],
  colors: [],
  images: [],
  bundleProductIds: [],
  regenerateSkus: false,
});

const fieldClass =
  "mt-2 w-full min-h-[44px] rounded-sm border border-sand bg-cream px-4 py-3 font-body text-base text-choc";
const labelClass = "mt-6 block font-sans text-[11px] font-medium uppercase tracking-[0.14em] text-choc/70";
const sectionClass = "glass-opaque p-8";
const btnPrimary =
  "inline-flex min-h-[44px] items-center justify-center rounded-sm bg-choc px-5 font-sans text-xs uppercase tracking-[0.14em] text-cream hover:bg-choc/90 disabled:opacity-30";
const btnGhost =
  "inline-flex min-h-[44px] items-center justify-center rounded-sm border border-sand px-5 font-sans text-xs uppercase tracking-[0.14em] text-choc hover:border-choc disabled:opacity-30";

export function ProductFormPage({
  product,
  customDefaults,
  layout: layoutProp,
  initialStep,
}: {
  product?: FullProduct;
  customDefaults?: {
    offeredDefault: boolean;
    surchargeKind: "NONE" | "PERCENT" | "FLAT";
    leadTimeDays: number;
    surchargeValue: number;
    returnable: boolean;
  };
  layout?: ProductFormLayout;
  initialStep?: number;
}) {
  const router = useRouter();
  const mode = product ? "edit" : "create";
  const layout = layoutProp ?? productFormLayout({ mode, wizardQuery: null });
  const wizard = layout === "wizard";
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

  const [step, setStep] = useState(() => {
    const n = initialStep ?? 0;
    return Number.isFinite(n) ? Math.min(Math.max(0, Math.floor(n)), STEPS.length - 1) : 0;
  });
  const [savedId, setSavedId] = useState<string | undefined>(product?.id);
  const [draftStatus, setDraftStatus] = useState<string | null>(null);
  const persistLock = useRef(false);
  const restored = useRef(false);
  const [libraryFields, setLibraryFields] = useState<{ id: string; key: string; label: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [reuploadingId, setReuploadingId] = useState<string | null>(null);
  const [colorUploading, setColorUploading] = useState<number | null>(null);
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
  const typeWatch = form.watch("type");
  const lastName = useRef(defaults.name);
  const storageId = savedId ?? (mode === "create" ? "new" : product?.id ?? "new");

  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    if (!wizard) return;
    const stored = readWizardDraft(mode === "create" && !product ? "new" : storageId);
    if (!stored) return;
    const fromCreate = mode === "create" && !product;
    const localNewer =
      product?.updatedAt && stored.savedAt > new Date(product.updatedAt).getTime() + 500;
    if (fromCreate || localNewer) {
      if (typeof stored.values === "object" && stored.values) {
        form.reset({ ...defaults, ...(stored.values as ProductAdminInput) });
      }
    }
    if (Number.isFinite(stored.step) && (fromCreate || initialStep == null)) {
      setStep(Math.min(Math.max(0, stored.step), STEPS.length - 1));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restore once on mount
  }, []);

  const snapshot = {
    name: nameWatch,
    images: form.watch("images"),
    variants: variantsWatch,
    basePriceNGN: basePriceWatch,
    category: form.watch("category"),
  };

  useEffect(() => {
    if (!wizard) return;
    writeWizardDraft(storageId, {
      step,
      values: form.getValues(),
      savedAt: Date.now(),
    });
  }, [wizard, storageId, step, nameWatch, basePriceWatch, variantsWatch, snapshot.images, form]);

  useEffect(() => {
    void fetch("/api/admin/measurement-fields")
      .then((r) => r.json())
      .then((j: { items?: { id: string; key: string; label: string }[] }) => setLibraryFields(j.items ?? []))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (nameWatch === lastName.current) return;
    const previous = lastName.current;
    lastName.current = nameWatch;
    const rows = form.getValues("variants");
    form.setValue(
      "variants",
      rows.map((v) => {
        if (v.skuManual) return v;
        if (v.id && previous && !isGeneratedProductSku(v.sku || "", previous, v.size)) return v;
        return { ...v, sku: buildDefaultProductSku(nameWatch, v.size || "SIZE") };
      }),
      { shouldDirty: false },
    );
  }, [nameWatch, form]);

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
    const id = savedId ?? product?.id;
    if (!id) {
      return { url, alt: "", isPrimary, sortOrder };
    }
    const res = await fetch(`/api/admin/products/${id}/images`, {
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

  const uploadColorFile = async (index: number, file: File | undefined) => {
    if (!file) return;
    setColorUploading(index);
    try {
      const url = await uploadAdminAsset(file, "prudential-atelier/products");
      form.setValue(`colors.${index}.imageUrl`, url);
      toast.success("Colour photo uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setColorUploading(null);
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

    if ((savedId ?? product?.id) && target.id) {
      try {
        const res = await fetch(`/api/admin/products/${savedId ?? product?.id}/images/${target.id}`, {
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

  const persistDraft = async (opts: { publish?: boolean; leave?: boolean; silent?: boolean } = {}) => {
    const values = form.getValues();
    const asPublish = Boolean(opts.publish);
    const draftMsg = draftBlockedMessage(values);
    if (draftMsg) {
      if (!opts.silent) toast.error(draftMsg);
      if (wizard) setStep(0);
      return false;
    }
    if (asPublish) {
      const blocked = publishBlockedMessage(values);
      if (blocked) {
        toast.error(blocked);
        if (wizard) {
          if (!values.name?.trim() || !(values.images ?? []).length) setStep(0);
          else setStep(1);
        }
        return false;
      }
    }

    if (!values.slug && values.name) {
      form.setValue("slug", slugify(values.name, { lower: true, strict: true }));
    }

    const payload = {
      ...form.getValues(),
      isPublished: asPublish,
      isBespokeAvail: form.getValues("type") === PT.BESPOKE,
    };

    if (persistLock.current) return false;
    persistLock.current = true;
    try {
      const id = savedId ?? product?.id;
      if (!id) {
        const res = await fetch("/api/admin/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as { id?: string; error?: unknown };
        if (!res.ok || !data.id) {
          throw new Error(typeof data.error === "string" ? data.error : "Could not save");
        }
        setSavedId(data.id);
        rekeyWizardDraft("new", data.id);
        writeWizardDraft(data.id, { step, values: form.getValues(), savedAt: Date.now() });
        if (opts.leave) {
          clearWizardDraft(data.id);
          toast.success("Draft saved. Come back when you can.");
          router.push("/admin/products");
          return true;
        }
        if (!opts.silent) {
          toast.success(asPublish ? "Published ✓" : "Draft saved");
        } else {
          setDraftStatus("Draft saved");
        }
        router.replace(`/admin/products/${data.id}/edit?wizard=1&step=${step}`);
        return true;
      }

      const res = await fetch(`/api/admin/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { error?: unknown };
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not save");
      form.setValue("regenerateSkus", false);
      writeWizardDraft(id, { step, values: form.getValues(), savedAt: Date.now() });
      if (opts.leave) {
        toast.success("Draft saved. Come back when you can.");
        router.push("/admin/products");
        return true;
      }
      if (!opts.silent) {
        toast.success(asPublish ? "Published ✓" : "Changes saved ✓");
      } else {
        setDraftStatus("Draft saved");
      }
      if (asPublish) clearWizardDraft(id);
      if (!opts.silent) router.refresh();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
      return false;
    } finally {
      persistLock.current = false;
    }
  };

  const onSubmit: SubmitHandler<ProductAdminInput> = async (values) => {
    await persistDraft({ publish: Boolean(values.isPublished) });
  };

  const submit = form.handleSubmit(onSubmit, (errors) => {
    const values = form.getValues();
    const blocked = values.isPublished ? publishBlockedMessage(values) : draftBlockedMessage(values);
    if (blocked) toast.error(blocked);
    if (errors.images || errors.name || errors.slug) {
      setStep(0);
      return;
    }
    if (errors.variants || errors.basePriceNGN) {
      setStep(1);
    }
  });

  const saveDraft = () => {
    form.setValue("isPublished", false);
    void persistDraft({ silent: false });
  };

  const saveAndFinishLater = () => {
    form.setValue("isPublished", false);
    void persistDraft({ leave: true });
  };

  const publish = () => {
    form.setValue("isPublished", true);
    void persistDraft({ publish: true });
  };

  const goToStep = (next: number) => {
    const clamped = Math.min(Math.max(0, next), STEPS.length - 1);
    if (wizard && draftNeedsNameSafe()) {
      void persistDraft({ silent: true });
    }
    setStep(clamped);
  };

  function draftNeedsNameSafe() {
    return (form.getValues("name") ?? "").trim().length > 0;
  }

  const setKind = (type: typeof PT.RTW | typeof PT.BESPOKE) => {
    form.setValue("type", type);
    form.setValue("isBespokeAvail", type === PT.BESPOKE);
  };

  const regenerateSkus = () => {
    const name = form.getValues("name");
    form.setValue(
      "variants",
      form.getValues("variants").map((v) =>
        v.skuManual ? v : { ...v, sku: buildDefaultProductSku(name, v.size || "SIZE"), skuManual: false },
      ),
    );
    form.setValue("regenerateSkus", true);
    toast.success("Codes will update when you save. Typed codes are left alone.");
  };

  const images = form.watch("images");
  const storeDefaultLead = customDefaults?.leadTimeDays ?? 21;
  const show = (i: number) => !wizard || step === i;

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/products" className="font-body text-sm text-choc/60 hover:text-choc">
            ← Products
          </Link>
          <h1 className="mt-3 font-display text-3xl text-choc">
            {mode === "create" ? "Add a piece" : product?.name}
          </h1>
          {wizard ? (
            <p className="mt-2 max-w-xl font-body text-base text-choc/70">
              Jump to any step. A draft only needs a name. Photos first — that is the piece.
            </p>
          ) : (
            <p className="mt-2 font-body text-sm text-choc/60">Change one thing and save. No walkthrough.</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <Link href="/admin/products/guide" className="font-sans text-xs uppercase tracking-wide text-gold hover:underline">
              How to fill this page
            </Link>
            {wizard && (savedId ?? product?.id) ? (
              <Link
                href={`/admin/products/${savedId ?? product?.id}/edit`}
                className="font-sans text-xs uppercase tracking-wide text-choc/70 hover:text-choc"
              >
                Open the full form
              </Link>
            ) : null}
            {!wizard && product?.id ? (
              <Link
                href={`/admin/products/${product.id}/edit?wizard=1`}
                className="font-sans text-xs uppercase tracking-wide text-choc/70 hover:text-choc"
              >
                Use the guided view
              </Link>
            ) : null}
            {draftStatus ? <span className="font-body text-xs text-choc/50">{draftStatus}</span> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(savedId ?? product?.id) ? (
            <button
              type="button"
              onClick={() => {
                const id = savedId ?? product?.id;
                if (!id) return;
                void fetch(`/api/admin/products/${id}/duplicate`, { method: "POST" })
                  .then(async (r) => {
                    const j = (await r.json()) as { id?: string; error?: string };
                    if (!r.ok || !j.id) throw new Error(j.error ?? "Duplicate failed");
                    toast.success("Unpublished copy created");
                    router.push(`/admin/products/${j.id}/edit`);
                  })
                  .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Duplicate failed"));
              }}
              className={btnGhost}
            >
              Duplicate
            </button>
          ) : null}
          {wizard ? (
            <button type="button" onClick={() => void saveAndFinishLater()} className={btnGhost}>
              Save and finish later
            </button>
          ) : (
            <button type="button" onClick={() => void saveDraft()} className={btnGhost}>
              Save draft
            </button>
          )}
          <button type="button" onClick={() => void publish()} className={btnPrimary}>
            Publish
          </button>
        </div>
      </div>

      {wizard ? (
        <ProductWizardRail step={step} onStep={goToStep} snapshot={snapshot} />
      ) : null}

      <form onSubmit={submit} className="space-y-8">
        {show(0) ? (
          <>
            <section className={sectionClass}>
              <h2 className="font-display text-2xl text-choc">
                Photos
                <Req />
              </h2>
              <p className="mt-2 font-body text-sm text-choc/60">
                This is the piece. At least one photo before you publish. A draft can wait.
              </p>
              <label className="mt-6 flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-[26px] border border-dashed border-[var(--glass-edge)] bg-[var(--glass-1-solid)] px-6 py-12 font-body text-base text-choc/60 hover:border-choc/40">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => void uploadFiles(e.target.files)}
                />
                {uploading ? "Uploading…" : "Drop photographs here, or tap to choose"}
              </label>
              <div className="mt-2 max-w-md">
                <UploadProgressBar value={uploadProgress} />
              </div>
              {form.formState.errors.images && (
                <p className="mt-2 font-body text-sm text-wine">{String(form.formState.errors.images.message ?? "")}</p>
              )}
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {images.map((im, idx) => (
                  <div key={im.id ?? `${im.url}-${idx}`} className="relative rounded-sm border border-sand p-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={im.url} alt="" className="h-36 w-full rounded-sm object-cover" />
                    {isLegacyWordPressImageUrl(im.url) && (
                      <div className="mt-1 space-y-1">
                        <p className="text-[10px] text-amber-700">Hosted on the old server</p>
                        {(savedId ?? product?.id) && im.id && (
                          <button
                            type="button"
                            disabled={reuploadingId === im.id}
                            onClick={() => void reuploadLegacyImage(idx)}
                            className="min-h-[44px] text-xs text-gold hover:underline disabled:opacity-50"
                          >
                            {reuploadingId === im.id ? "Migrating…" : "Re-upload to Cloudinary →"}
                          </button>
                        )}
                      </div>
                    )}
                    <div className="mt-2 flex min-h-[44px] items-center justify-between gap-1">
                      <button
                        type="button"
                        onClick={() => setPrimary(idx)}
                        className={cn("min-h-[44px] text-sm", im.isPrimary ? "text-gold" : "text-choc/50")}
                      >
                        {im.isPrimary ? "Primary" : "Set as primary"}
                      </button>
                      <button
                        type="button"
                        className="min-h-[44px] text-sm text-wine"
                        onClick={() => void removeImage(idx)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className={sectionClass}>
              <h2 className="font-display text-2xl text-choc">The piece</h2>
              <label className={labelClass}>
                Name
                <Req />
                <input {...form.register("name", { onBlur: onBlurName })} className={fieldClass} />
              </label>
              {form.formState.errors.name && (
                <p className="mt-1 font-body text-sm text-wine">{form.formState.errors.name.message}</p>
              )}
              <label className={labelClass}>
                Short description
                <Opt />
                <textarea {...form.register("description")} maxLength={200} rows={3} className={fieldClass} />
              </label>
              <p className="mt-1 font-body text-xs text-choc/50">One or two sentences. Max 200 characters.</p>
              <label className={labelClass}>
                Full description
                <Opt />
                <textarea {...form.register("details")} rows={8} className={fieldClass} />
              </label>
              <details className="mt-8 border-t border-sand pt-6">
                <summary className="cursor-pointer font-display text-xl text-choc">Advanced</summary>
                <label className={labelClass}>
                  Web address
                  <Opt />
                  <input {...form.register("slug")} className={`${fieldClass} font-mono text-sm`} />
                </label>
                <p className="mt-1 font-body text-xs text-choc/50">
                  {getPublicAppUrl().replace(/^https?:\/\//, "")}/shop/{slugWatch || "from-the-name"}
                </p>
              </details>
            </section>

            <section className={sectionClass}>
              <h2 className="font-display text-2xl text-choc">
                Colours
                <Opt />
              </h2>
              <button
                type="button"
                className={`${btnGhost} mt-4`}
                onClick={() => appendColor({ name: "New", hex: "#000000", imageUrl: null })}
              >
                Add colour
              </button>
              <div className="mt-4 space-y-3">
                {colorFields.map((field, i) => (
                  <div key={field.id} className="flex flex-wrap items-end gap-2">
                    <input
                      {...form.register(`colors.${i}.name`)}
                      className="min-h-[44px] min-w-[100px] flex-1 rounded-sm border border-sand bg-cream px-3 py-2 font-body text-sm text-choc"
                      placeholder="Name"
                    />
                    <input type="color" {...form.register(`colors.${i}.hex`)} className="h-11 w-12 cursor-pointer bg-transparent" />
                    <label className={`${btnGhost} cursor-pointer`}>
                      {colorUploading === i ? "Uploading…" : form.watch(`colors.${i}.imageUrl`) ? "Replace photo" : "Upload photo"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={colorUploading === i}
                        onChange={(e) => void uploadColorFile(i, e.target.files?.[0])}
                      />
                    </label>
                    <button type="button" className="min-h-[44px] min-w-[44px] text-wine" onClick={() => removeColor(i)}>
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : null}

        {show(1) ? (
          <section className={sectionClass}>
            <h2 className="font-display text-2xl text-choc">Sizes and prices</h2>
            <label className={labelClass}>
              Price in naira
              <Req />
              <input
                type="number"
                {...form.register("basePriceNGN", { valueAsNumber: true })}
                className={fieldClass}
              />
            </label>
            <p className="mt-1 text-xs text-[#A8A8A4]">Copied onto each new size. Then change a size if it costs more.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-xs uppercase text-[#A8A8A4]">
                Price in dollars
                <Opt />
                <input type="number" step="any" {...form.register("basePriceUSD")} className={fieldClass} />
              </label>
              <label className="text-xs uppercase text-[#A8A8A4]">
                Price in pounds
                <Opt />
                <input type="number" step="any" {...form.register("basePriceGBP")} className={fieldClass} />
              </label>
            </div>
            <div className="mt-4">
              <Controller
                control={form.control}
                name="isOnSale"
                render={({ field }) => (
                  <label className="flex items-center gap-2 text-sm text-charcoal">
                    <input type="checkbox" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />
                    On sale
                  </label>
                )}
              />
            </div>
            {saleFigureIsDormant(Boolean(isOnSaleWatch), variantsWatch ?? []) ? (
              <p className="mt-3 text-xs text-amber-800">
                A sale price is filled, but “On sale” is off. Shoppers pay the regular price until you tick it.
              </p>
            ) : null}
            <p className="mt-4 text-xs uppercase tracking-wide text-[#A8A8A4]">
              Sizes
              {categoryNeedsSizes(form.watch("category")) ? <Req /> : <Opt />}
            </p>
            <Controller
              control={form.control}
              name="variants"
              render={({ field }) => (
                <VariantManager
                  productName={nameWatch || "item"}
                  variants={field.value}
                  onChange={field.onChange}
                  basePriceNGN={basePriceWatch}
                  isOnSale={Boolean(isOnSaleWatch)}
                  onRegenerate={(savedId ?? product?.id) ? regenerateSkus : undefined}
                />
              )}
            />
            {form.formState.errors.variants && (
              <p className="mt-2 text-xs text-red-400">
                {categoryNeedsSizes(form.getValues("category"))
                  ? "Add at least one size with a price."
                  : "Enter a price before publishing."}
              </p>
            )}
            {form.formState.errors.basePriceNGN && (
              <p className="mt-2 text-xs text-red-400">Enter a naira price.</p>
            )}
            {product?.id ? (
              <p className="mt-4 font-body text-[13px]">
                <Link href={`/admin/products/${product.id}/stock`} className="text-olive hover:underline">
                  Stock history
                </Link>
                <span className="text-[#6B6B68]"> — every sale, count, and return for each size.</span>
              </p>
            ) : null}
          </section>
        ) : null}

        {show(2) ? (
          <>
            <details className={sectionClass}>
              <summary className="cursor-pointer font-display text-2xl text-choc">Custom measurements</summary>
              <p className="mt-1 text-xs text-[#A8A8A4]">Made to order. Does not take stock.</p>
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
                  <Controller
                    control={form.control}
                    name="customOfferedWhenSoldOut"
                    render={({ field }) => (
                      <label className="flex justify-between gap-2">
                        Keep offering it after the sizes sell out
                        <input
                          type="checkbox"
                          checked={Boolean(field.value)}
                          onChange={(e) => field.onChange(e.target.checked)}
                        />
                      </label>
                    )}
                  />
                  <p className="text-[11px] text-[#A8A8A4]">
                    Off by default. Only tick this if the fabric can be sourced again. A sold-out one-off must not
                    promise a remake.
                  </p>
                  <label className="block text-xs uppercase text-[#A8A8A4]">
                    Surcharge
                    <select {...form.register("customSurchargeKind")} className={fieldClass}>
                      <option value="">Use store default</option>
                      <option value="NONE">None</option>
                      <option value="PERCENT">Percent</option>
                      <option value="FLAT">Flat ₦</option>
                    </select>
                  </label>
                  <label className="block text-xs uppercase text-[#A8A8A4]">
                    Surcharge value
                    <input type="number" step="0.01" {...form.register("customSurchargeValue")} className={fieldClass} />
                  </label>
                  <label className="block text-xs uppercase text-[#A8A8A4]">
                    Lead time (days)
                    <input
                      type="number"
                      {...form.register("customLeadTimeDays")}
                      className={fieldClass}
                      placeholder={`Store default (${storeDefaultLead})`}
                    />
                  </label>
                  <p className="text-xs text-[#A8A8A4]">Leave blank to use the store default of {storeDefaultLead} days.</p>
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
            </details>

            <details className={sectionClass}>
              <summary className="cursor-pointer font-display text-2xl text-choc">Delivery details</summary>
              <p className="mt-2 font-body text-sm text-choc/60">Most pieces use the store default box. Fill this only if this garment packs differently.</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-4">
                <label className="text-xs uppercase text-[#A8A8A4]">
                  Weight kg
                  <input type="number" step="0.01" {...form.register("defaultWeightKg")} className={fieldClass} />
                </label>
                <label className="text-xs uppercase text-[#A8A8A4]">
                  Box size when packed — length
                  <input type="number" step="0.1" {...form.register("defaultLengthCm")} className={fieldClass} />
                </label>
                <label className="text-xs uppercase text-[#A8A8A4]">
                  Width
                  <input type="number" step="0.1" {...form.register("defaultWidthCm")} className={fieldClass} />
                </label>
                <label className="text-xs uppercase text-[#A8A8A4]">
                  Height
                  <input type="number" step="0.1" {...form.register("defaultHeightCm")} className={fieldClass} />
                </label>
              </div>
            </details>
          </>
        ) : null}

        {show(3) ? (
          <>
            <section className={sectionClass}>
              <h2 className="font-display text-2xl text-choc">Publishing</h2>
              <p className="mt-2 font-body text-sm text-choc/60">
                Drafts stay off the shop. Collections are chosen on the collection page.
              </p>
              <label className={labelClass}>
                Category
                <select {...form.register("category")} className={fieldClass}>
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset className="mt-4 text-sm text-charcoal">
                <legend className="text-xs uppercase text-[#A8A8A4]">Ready to wear or bespoke</legend>
                <label className="mr-4 mt-2 inline-flex items-center gap-2">
                  <input
                    type="radio"
                    checked={typeWatch === PT.RTW}
                    onChange={() => setKind(PT.RTW)}
                  />
                  Ready to wear
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    checked={typeWatch === PT.BESPOKE}
                    onChange={() => setKind(PT.BESPOKE)}
                  />
                  Bespoke
                </label>
                <p className="mt-1 text-xs text-[#A8A8A4]">
                  Ready to wear sells from stock. Bespoke shows an atelier consultation on the product page.
                </p>
              </fieldset>
              <div className="mt-4 space-y-3 text-sm text-charcoal">
                <Controller
                  control={form.control}
                  name="isFeatured"
                  render={({ field }) => (
                    <label className="flex justify-between gap-2">
                      <span>
                        Show on the homepage
                        <span className="block text-[11px] text-[#A8A8A4]">You choose this. It is not updated from sales.</span>
                      </span>
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
              </div>
              <label className={labelClass}>
                Tags
                <Opt />
                <input
                  className={fieldClass}
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
              {product && (
                <p className="mt-4 text-xs text-[#A8A8A4]">Updated {new Date(product.updatedAt).toLocaleString()}</p>
              )}
            </section>

            <section className={sectionClass}>
              <h2 className="font-display text-2xl text-choc">
                Complete the Look
                <Opt />
              </h2>
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
                            className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-canvas disabled:opacity-40"
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
                      className="inline-flex items-center gap-2 rounded-full border border-sand bg-canvas py-1 pl-1 pr-2 text-xs text-charcoal"
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

            <details className={sectionClass}>
              <summary className="cursor-pointer font-display text-2xl text-choc">How this looks on Google</summary>
              <p className="mt-2 text-xs text-[#A8A8A4]">Leave blank to use the product name and short description.</p>
              <label className="mt-3 block text-xs uppercase text-[#A8A8A4]">
                Title
                <input {...form.register("metaTitle")} maxLength={60} className={fieldClass} />
              </label>
              <label className="mt-3 block text-xs uppercase text-[#A8A8A4]">
                Description
                <textarea {...form.register("metaDescription")} maxLength={160} rows={3} className={fieldClass} />
              </label>
            </details>
          </>
        ) : null}

        {wizard ? (
        <div className="flex justify-between gap-3">
          <button
            type="button"
            disabled={step === 0}
            onClick={() => goToStep(step - 1)}
            className={btnGhost}
          >
            Back
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={() => goToStep(step + 1)} className={btnPrimary}>
              Next
            </button>
          ) : (
            <button type="button" onClick={() => void saveAndFinishLater()} className={btnGhost}>
              Save and finish later
            </button>
          )}
        </div>
        ) : (
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => void saveDraft()} className={btnGhost}>
            Save draft
          </button>
          <button type="button" onClick={() => void publish()} className={btnPrimary}>
            Publish
          </button>
        </div>
        )}
      </form>
    </div>
  );
}
