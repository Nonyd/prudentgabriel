import { revalidatePath, revalidateTag } from "next/cache";

/** Call after any admin save operation; pass extra paths as needed. */
export async function revalidateStorefront(paths: string[] = []) {
  const corePaths = [
    "/",
    "/shop",
    "/rtw",
    "/collections",
    "/atelier",
    "/bridal",
    "/kids",
    "/consultation",
    "/bespoke",
    "/our-story",
    "/journal",
  ];

  const allPaths = Array.from(new Set([...corePaths, ...paths]));
  for (const path of allPaths) {
    revalidatePath(path);
  }
  revalidateTag("cms-chrome");
  revalidateTag("nav-collections");
}

export async function revalidateProduct(slug: string) {
  revalidatePath(`/shop/${slug}`);
  revalidatePath(`/rtw/${slug}`);
  revalidatePath("/shop");
  revalidatePath("/rtw");
  revalidatePath("/");
}

export async function revalidateCollection(slug: string) {
  revalidatePath(`/collections/${slug}`);
  revalidatePath("/collections");
  revalidatePath("/");
  revalidateTag("nav-collections");
}

export async function revalidateJournal(slug?: string) {
  revalidatePath("/journal");
  revalidatePath("/");
  if (slug) revalidatePath(`/journal/${slug}`);
}

export async function revalidateSettings() {
  revalidatePath("/", "layout");
  revalidateTag("logo-settings");
  revalidateTag("cms-chrome");
  revalidateTag("maintenance");
}

export async function revalidateGallery(category: "ATELIER" | "BRIDAL" | "KIDS") {
  const pathMap = {
    ATELIER: "/atelier",
    BRIDAL: "/bridal",
    KIDS: "/kids",
  } as const;
  revalidatePath(pathMap[category]);
}

/** After bulk product import — avoid per-product revalidation. */
export async function revalidateAfterBulkImport() {
  revalidatePath("/shop");
  revalidatePath("/rtw");
}
