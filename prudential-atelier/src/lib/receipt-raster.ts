import sharp from "sharp";

/**
 * Decode a phone still into a JPEG the admin lightbox can show.
 *
 * GHSA-rgj7-g3m4-5g8c / GHSA-g89c-p67h-r497: untrusted HEIC/AVIF through libheif
 * can RCE on glibc Linux. We require sharp ≥0.35.4 (bundles libheif 1.23.2).
 *
 * Do NOT fall back to `heic-convert` / `libheif-js@1.19.x` — that stack is still
 * on a vulnerable libheif and sits on the public guest receipt-upload route.
 * If sharp cannot decode the file, ask the client for JPEG/PNG instead.
 */
export async function receiptRasterToJpeg(input: Buffer): Promise<Buffer> {
  return sharp(input, { failOn: "none" })
    .rotate()
    .resize({
      width: 2400,
      height: 2400,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
}
