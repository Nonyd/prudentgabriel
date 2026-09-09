import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMediaStore } from "@/lib/media";
import { mimeFromMagicBytes } from "@/lib/image-upload-mime";
import { rateLimitOr429 } from "@/lib/rate-limit";
import { receiptRasterToJpeg } from "@/lib/receipt-raster";
import { logServerError } from "@/lib/logger";

const MAX_BYTES = 5 * 1024 * 1024;
const FOLDER = "prudential-atelier/receipts";

function isFileLike(v: unknown): v is Blob & { name?: string } {
  return typeof v === "object" && v !== null && typeof (v as Blob).arrayBuffer === "function";
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const limited = rateLimitOr429(req, "invoice-receipt-upload", 12, 15 * 60 * 1000);
  if (limited) return limited;

  const { token } = await ctx.params;
  const inv = await prisma.invoice.findUnique({
    where: { publicToken: token },
    select: { id: true },
  });
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const raw = form.get("file");
  if (!isFileLike(raw)) {
    return NextResponse.json({ error: "Missing file field" }, { status: 400 });
  }
  if (raw.size > MAX_BYTES) {
    return NextResponse.json({ error: "File must be 5MB or smaller" }, { status: 400 });
  }

  const fileName = "name" in raw && typeof raw.name === "string" ? raw.name : undefined;
  let buffer = Buffer.from(await raw.arrayBuffer());
  const mime = mimeFromMagicBytes(buffer, { allowPdf: true, allowHeic: true });
  if (!mime) {
    return NextResponse.json({ error: "Only photos or a PDF are allowed" }, { status: 400 });
  }

  let storedMime = mime;
  let storedName = fileName;
  if (mime === "image/heic") {
    try {
      buffer = Buffer.from(await receiptRasterToJpeg(buffer));
      storedMime = "image/jpeg";
      storedName = fileName?.replace(/\.(heic|heif)$/i, ".jpg") ?? "receipt.jpg";
    } catch (e) {
      await logServerError({ errorType: "RECEIPT_HEIC", error: e });
      return NextResponse.json(
        { error: "Could not read this iPhone photo. Try saving it as a JPG, or take the photo again." },
        { status: 400 },
      );
    }
  }

  try {
    const stored = await getMediaStore().put(buffer, {
      folder: FOLDER,
      originalName: storedName,
      mime: storedMime,
      private: true,
    });
    return NextResponse.json({ url: stored.url, publicId: stored.key });
  } catch (e) {
    await logServerError({ errorType: "INVOICE_RECEIPT_UPLOAD", error: e });
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
