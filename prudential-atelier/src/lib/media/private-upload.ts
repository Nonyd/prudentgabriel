import { NextResponse } from "next/server";
import { getMediaStore, type StoredFile } from "@/lib/media";
import { RECEIPT_HEIC_FALLBACK_MESSAGE, mimeFromMagicBytes } from "@/lib/image-upload-mime";
import { receiptRasterToJpeg } from "@/lib/receipt-raster";
import { logServerError } from "@/lib/logger";

/**
 * The upload path for files that arrive from customers and strangers — bank
 * receipts (since Slice AZ1) and, from Slice BF7, chat attachments. One set of
 * checks, one store:
 * - 5MB at most;
 * - the type is read from the bytes, never from the name or the browser: JPEG,
 *   PNG, WebP or PDF. SVG, HTML and everything else fail the allowlist;
 * - an iPhone HEIC photo is converted to JPEG (browsers cannot show HEIC);
 * - stored private: a private key is never served from a public /media path.
 */

export const PRIVATE_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

function isFileLike(v: unknown): v is Blob & { name?: string } {
  return typeof v === "object" && v !== null && typeof (v as Blob).arrayBuffer === "function";
}

export type PrivateUploadResult =
  | { ok: true; stored: StoredFile; mime: string; originalName: string; bytes: number }
  | { ok: false; response: NextResponse };

export async function storePrivateUpload(
  raw: FormDataEntryValue | null,
  opts: { folder: string; errorType: string; fallbackName: string },
): Promise<PrivateUploadResult> {
  const fail = (error: string, status = 400) => ({ ok: false as const, response: NextResponse.json({ error }, { status }) });
  if (!isFileLike(raw)) return fail("Missing file field");
  if (raw.size > PRIVATE_UPLOAD_MAX_BYTES) return fail("File must be 5MB or smaller");

  const fileName = "name" in raw && typeof raw.name === "string" ? raw.name : undefined;
  let buffer = Buffer.from(await raw.arrayBuffer());
  const mime = mimeFromMagicBytes(buffer, { allowPdf: true, allowHeic: true });
  if (!mime) return fail("Only photos or a PDF are allowed");

  let storedMime = mime;
  let storedName = fileName;
  if (mime === "image/heic") {
    try {
      buffer = Buffer.from(await receiptRasterToJpeg(buffer));
      storedMime = "image/jpeg";
      storedName = fileName?.replace(/\.(heic|heif)$/i, ".jpg") ?? `${opts.fallbackName}.jpg`;
    } catch (e) {
      await logServerError({ errorType: `${opts.errorType}_HEIC`, error: e });
      return fail(RECEIPT_HEIC_FALLBACK_MESSAGE);
    }
  }

  try {
    const stored = await getMediaStore().put(buffer, {
      folder: opts.folder,
      originalName: storedName,
      mime: storedMime,
      private: true,
    });
    return {
      ok: true,
      stored,
      mime: storedMime,
      originalName: (storedName ?? opts.fallbackName).replace(/[^\w .()-]/g, "_").slice(0, 120) || opts.fallbackName,
      bytes: buffer.length,
    };
  } catch (e) {
    await logServerError({ errorType: opts.errorType, error: e });
    return fail("Upload failed", 500);
  }
}
