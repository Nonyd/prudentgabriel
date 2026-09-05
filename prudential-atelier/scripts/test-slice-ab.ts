/**
 * Slice AB: receipt HEIC + private URL; product wizard rail, draft, publish gates.
 *
 *   pnpm test:slice-ab
 */
import "./preload-test-env";
import { ProductCategory } from "@prisma/client";
import { z } from "zod";
import { mimeFromMagicBytes, isHeifMagic } from "../src/lib/image-upload-mime";
import { isStoredReceiptMediaUrl, receiptMediaUrlSchema, storedPrivateMediaUrlSchema, emptyableStoredPublicMediaUrlSchema } from "../src/lib/media/stored-url";
import { productAdminSchema } from "../src/validations/product";
import { slugStemFromName } from "../src/lib/product-slug-unique";
import {
  categoryNeedsSizes,
  clearWizardDraft,
  draftBlockedMessage,
  missingPublishNeeds,
  productFormLayout,
  publishBlockedMessage,
  readWizardDraft,
  rekeyWizardDraft,
  setWizardKv,
  wizardStepComplete,
  writeWizardDraft,
} from "../src/lib/product-wizard";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

function heicBytes(): Buffer {
  const b = Buffer.alloc(32, 0);
  b.write("ftypheic", 4, "ascii");
  return b;
}

function memoryKv() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      m.set(k, v);
    },
    removeItem: (k: string) => {
      m.delete(k);
    },
  };
}

function draftInput(over: Record<string, unknown> = {}) {
  return {
    name: "Avril",
    slug: "avril",
    category: ProductCategory.BRIDAL,
    type: "RTW",
    tags: [],
    basePriceNGN: 0,
    isOnSale: false,
    isPublished: false,
    isFeatured: false,
    isNewArrival: false,
    isBespokeAvail: false,
    variants: [],
    colors: [],
    images: [],
    bundleProductIds: [],
    ...over,
  };
}

async function run() {
  const heic = heicBytes();
  assert(mimeFromMagicBytes(heic) === null, "catalogue uploads still refuse HEIC");
  assert(mimeFromMagicBytes(heic, { allowHeic: true }) === "image/heic", "receipt route can recognise HEIC");
  assert(isHeifMagic(heic), "iPhone camera stills are HEIF");

  const relative = "/media/private/prudential-atelier/receipts/d20f6ffd523b78a86cd2f916fa34af5d.jpg";
  assert(z.string().url().safeParse(relative).success === false, "z.string().url rejects the X5 path");
  assert(isStoredReceiptMediaUrl(relative), "receipt schema accepts the X5 path");
  assert(receiptMediaUrlSchema.safeParse(relative).success, "bank-transfer can store a local receipt");
  assert(
    storedPrivateMediaUrlSchema.safeParse("/media/private/prudential-atelier/careers/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.pdf").success,
    "a CV path is a private media URL",
  );
  assert(
    emptyableStoredPublicMediaUrlSchema.safeParse("/media/public/prudential-atelier/avatars/admin/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg").success,
    "an avatar path is a public media URL",
  );

  assert(productFormLayout({ mode: "create" }) === "wizard", "creating uses the wizard");
  assert(productFormLayout({ mode: "edit" }) === "full", "editing does not enter the wizard");
  assert(productFormLayout({ mode: "edit", wizardQuery: "1" }) === "wizard", "edit can opt into the guided view");

  const nameOnly = productAdminSchema.safeParse(draftInput());
  assert(nameOnly.success, "a named draft with no price, photo, or size can save");

  const unnamed = productAdminSchema.safeParse(draftInput({ name: "" }));
  assert(!unnamed.success, "a draft still needs a name");
  assert(draftBlockedMessage({ name: "" }) === "Give this piece a name to save a draft.", "draft copy");

  const publishBare = productAdminSchema.safeParse(draftInput({ isPublished: true }));
  assert(!publishBare.success, "publish is refused without price, photo, and size");
  const blocked = publishBlockedMessage(draftInput({ isPublished: true }));
  assert(blocked?.includes("a price"), "publish reason names the price");
  assert(blocked?.includes("one photo"), "publish reason names the photo");
  assert(blocked?.includes("one size"), "publish reason names the size");

  const ready = productAdminSchema.safeParse(
    draftInput({
      isPublished: true,
      basePriceNGN: 85000,
      images: [{ url: "https://res.cloudinary.com/demo/image/upload/x.jpg", alt: "", isPrimary: true, sortOrder: 0 }],
      variants: [{ size: "10", priceNGN: 85000, stock: 1, lowStockAt: 3, sortOrder: 0 }],
    }),
  );
  assert(ready.success, "publish succeeds with name, price, photo, and size");

  const snap = {
    name: "Avril",
    images: [] as { url?: string }[],
    variants: [] as { size?: string; priceNGN?: number }[],
    basePriceNGN: 0,
    category: ProductCategory.BRIDAL,
  };
  assert(!wizardStepComplete(0, snap), "piece is not ticked without a photo");
  assert(wizardStepComplete(0, { ...snap, images: [{ url: "/media/public/x.jpg" }] }), "piece ticks with name and photo");
  assert(wizardStepComplete(2, snap), "delivery is optional so it is complete");
  assert(missingPublishNeeds(snap).some((n) => n.id === "size"), "dresses still need a size today");
  assert(categoryNeedsSizes(ProductCategory.ACCESSORIES) === true, "ACCESSORIES still needs sizes until that category is built");

  const kv = memoryKv();
  setWizardKv(kv);
  writeWizardDraft("new", {
    step: 2,
    values: { name: "Netania", description: "kept" },
    savedAt: 1,
  });
  const loaded = readWizardDraft("new");
  assert(loaded?.step === 2, "draft step survives a refresh");
  assert((loaded?.values as { name: string }).name === "Netania", "draft values survive a refresh");
  writeWizardDraft("new", {
    step: 3,
    values: { name: "Netania", description: "kept", basePriceNGN: 12 },
    savedAt: 2,
  });
  const jumped = readWizardDraft("new");
  assert(jumped?.step === 3, "jumping forward keeps the store");
  assert((jumped?.values as { description: string }).description === "kept", "jumping to a later step loses nothing");
  writeWizardDraft("new", {
    step: 0,
    values: jumped!.values,
    savedAt: 3,
  });
  const back = readWizardDraft("new");
  assert((back?.values as { basePriceNGN: number }).basePriceNGN === 12, "jumping back keeps later-step work");
  rekeyWizardDraft("new", "prod_1");
  assert(readWizardDraft("new") === null, "create key is cleared after first save");
  assert(readWizardDraft("prod_1")?.step === 0, "draft is rekeyed onto the saved product");
  clearWizardDraft("prod_1");
  setWizardKv(null);

  assert(slugStemFromName("The Avril Gown") === "the-avril-gown", "web address still comes from the name");

  console.log("test:slice-ab passed");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
