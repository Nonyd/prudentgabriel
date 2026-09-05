import sharp from "sharp";
import convert from "heic-convert";

async function rasterize(input: Buffer): Promise<Buffer> {
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

/**
 * Decode a phone still into a JPEG the admin lightbox can show.
 * Sharp's Linux build often includes HEVC; Windows (and some images) do not —
 * `heic-convert` (libheif-js) covers iPhone camera photos in that case.
 */
export async function receiptRasterToJpeg(input: Buffer): Promise<Buffer> {
  try {
    return Buffer.from(await rasterize(input));
  } catch {
    const decoded = await convert({
      buffer: input,
      format: "JPEG",
      quality: 0.85,
    });
    return Buffer.from(await rasterize(Buffer.from(decoded)));
  }
}
