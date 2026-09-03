import { getMediaStore } from "@/lib/media";
import { mimeFromMagicBytes } from "@/lib/image-upload-mime";
import { classifyMediaUrl } from "@/lib/media/migrate-plan";

export const PRODUCT_CLOUDINARY_FOLDER = "prudential-atelier/products";

/** Re-host a remote product image onto the local MediaStore. */
export async function uploadProductImageFromUrl(sourceUrl: string): Promise<string> {
  const cls = classifyMediaUrl(sourceUrl);
  if (cls.action === "already-local") return sourceUrl;

  const res = await fetch(sourceUrl);
  if (!res.ok) {
    throw new Error(`Could not fetch source image (${res.status})`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const mime = mimeFromMagicBytes(buf);
  if (!mime || mime === "application/pdf") {
    throw new Error("Source is not a JPEG, PNG, or WebP image");
  }
  const stored = await getMediaStore().put(buf, {
    folder: PRODUCT_CLOUDINARY_FOLDER,
    mime,
    private: false,
    originalName: sourceUrl.split("/").pop(),
  });
  return stored.url;
}
