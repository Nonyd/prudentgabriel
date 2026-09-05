import { ProductCategory } from "@prisma/client";

export const PRODUCT_WIZARD_STEPS = [
  { id: "piece", label: "The piece" },
  { id: "sizes", label: "Sizes and prices" },
  { id: "delivery", label: "Delivery and custom" },
  { id: "publish", label: "Publishing" },
] as const;

export type ProductFormLayout = "wizard" | "full";

export function productFormLayout(opts: {
  mode: "create" | "edit";
  wizardQuery?: string | null;
}): ProductFormLayout {
  if (opts.mode === "create") return "wizard";
  return opts.wizardQuery === "1" ? "wizard" : "full";
}

export type PublishNeed = {
  id: "name" | "price" | "photo" | "size";
  label: string;
  path: "name" | "basePriceNGN" | "images" | "variants";
};

export type PublishSnapshot = {
  name?: string;
  images?: { url?: string }[];
  variants?: { size?: string; priceNGN?: number }[];
  basePriceNGN?: number;
  category?: ProductCategory;
};

/** Categories that skip UK sizes. Empty until ACCESSORIES (scarves, jewellery) is sold that way. */
const CATEGORIES_WITHOUT_SIZES = new Set<ProductCategory>([]);

/**
 * Scarves and jewellery will not use UK sizes. Keep every publish-size check behind this
 * so ACCESSORIES can drop the size requirement in one place later.
 * Do not special-case ACCESSORIES until that category is actually sold.
 */
export function categoryNeedsSizes(category?: ProductCategory): boolean {
  if (!category) return true;
  return !CATEGORIES_WITHOUT_SIZES.has(category);
}

export function draftNeedsName(data: PublishSnapshot): boolean {
  return (data.name ?? "").trim().length > 0;
}

export function hasPublishPrice(data: PublishSnapshot): boolean {
  const base = Number(data.basePriceNGN);
  if (Number.isFinite(base) && base > 0) return true;
  return (data.variants ?? []).some((v) => Number(v.priceNGN) > 0);
}

export function hasPublishPhoto(data: PublishSnapshot): boolean {
  return (data.images ?? []).some((im) => Boolean(im.url));
}

export function hasPublishSize(data: PublishSnapshot): boolean {
  return (data.variants ?? []).some((v) => (v.size ?? "").trim().length > 0);
}

export function publishNeedsFor(category?: ProductCategory): PublishNeed[] {
  const needs: PublishNeed[] = [
    { id: "name", label: "a name", path: "name" },
    { id: "price", label: "a price", path: "basePriceNGN" },
    { id: "photo", label: "one photo", path: "images" },
  ];
  if (categoryNeedsSizes(category)) {
    needs.push({ id: "size", label: "one size", path: "variants" });
  }
  return needs;
}

export function missingPublishNeeds(data: PublishSnapshot): PublishNeed[] {
  return publishNeedsFor(data.category).filter((need) => {
    if (need.id === "name") return !draftNeedsName(data);
    if (need.id === "price") return !hasPublishPrice(data);
    if (need.id === "photo") return !hasPublishPhoto(data);
    return !hasPublishSize(data);
  });
}

export function joinNeedLabels(labels: string[]): string {
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0]!;
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

export function publishBlockedMessage(data: PublishSnapshot): string | null {
  const missing = missingPublishNeeds(data);
  if (!missing.length) return null;
  return `To publish this piece it still needs ${joinNeedLabels(missing.map((m) => m.label))}.`;
}

export function draftBlockedMessage(data: PublishSnapshot): string | null {
  if (draftNeedsName(data)) return null;
  return "Give this piece a name to save a draft.";
}

/** A green tick means the step's work is actually there, not that she opened it. */
export function wizardStepComplete(step: number, data: PublishSnapshot): boolean {
  if (step === 0) return draftNeedsName(data) && hasPublishPhoto(data);
  if (step === 1) {
    if (!hasPublishPrice(data)) return false;
    return categoryNeedsSizes(data.category) ? hasPublishSize(data) : true;
  }
  if (step === 2) return true;
  if (step === 3) return missingPublishNeeds(data).length === 0;
  return false;
}

export function wizardStepHint(step: number, data: PublishSnapshot): string {
  if (step === 0) {
    if (!draftNeedsName(data)) return "Needs a name to save";
    if (!hasPublishPhoto(data)) return "Needs a photo to publish";
    return "Done";
  }
  if (step === 1) {
    if (!hasPublishPrice(data) && (!categoryNeedsSizes(data.category) || !hasPublishSize(data))) {
      return "Needs a price and one size to publish";
    }
    if (!hasPublishPrice(data)) return "Needs a price to publish";
    if (categoryNeedsSizes(data.category) && !hasPublishSize(data)) return "Needs one size to publish";
    return "Done";
  }
  if (step === 2) return "Optional";
  if (step === 3) {
    const blocked = publishBlockedMessage(data);
    return blocked ?? "Ready to publish";
  }
  return "";
}

export type WizardKv = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

let kvOverride: WizardKv | null = null;

export function setWizardKv(next: WizardKv | null): void {
  kvOverride = next;
}

function store(): WizardKv | null {
  if (kvOverride) return kvOverride;
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function wizardStorageKey(productId: string | "new"): string {
  return `pg.product-wizard:${productId}`;
}

export type StoredWizardDraft = {
  step: number;
  values: unknown;
  savedAt: number;
};

export function writeWizardDraft(productId: string | "new", draft: StoredWizardDraft): void {
  const s = store();
  if (!s) return;
  s.setItem(wizardStorageKey(productId), JSON.stringify(draft));
}

export function readWizardDraft(productId: string | "new"): StoredWizardDraft | null {
  const s = store();
  if (!s) return null;
  const raw = s.getItem(wizardStorageKey(productId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredWizardDraft;
    if (!parsed || typeof parsed.step !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearWizardDraft(productId: string | "new"): void {
  store()?.removeItem(wizardStorageKey(productId));
}

export function rekeyWizardDraft(from: string | "new", to: string): void {
  const existing = readWizardDraft(from);
  if (!existing) return;
  writeWizardDraft(to, existing);
  if (from !== to) clearWizardDraft(from);
}
