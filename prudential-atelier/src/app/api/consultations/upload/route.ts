import { NextRequest, NextResponse } from "next/server";
import { cloudinary } from "@/lib/cloudinary";
import { mimeFromMagicBytes } from "@/lib/image-upload-mime";
import { rateLimitOr429 } from "@/lib/rate-limit";

const MAX_BYTES = 5 * 1024 * 1024;
const PLACEHOLDER =
  "https://images.unsplash.com/photo-1519741497674-611481863552?w=1200&q=80&auto=format";

function isFileLike(v: unknown): v is Blob & { name?: string } {
  return typeof v === "object" && v !== null && typeof (v as Blob).arrayBuffer === "function";
}

export async function POST(req: NextRequest) {
  const limited = rateLimitOr429(req, "consultations-upload", 8, 15 * 60 * 1000);
  if (limited) return limited;

  const configured =
    Boolean(process.env.CLOUDINARY_API_KEY?.length) &&
    Boolean(process.env.CLOUDINARY_API_SECRET?.length) &&
    Boolean(process.env.CLOUDINARY_CLOUD_NAME?.length);

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
    return NextResponse.json({ error: "Image must be 5MB or smaller" }, { status: 400 });
  }

  const buffer = Buffer.from(await raw.arrayBuffer());
  const mime = mimeFromMagicBytes(buffer);
  if (!mime || mime === "application/pdf") {
    return NextResponse.json({ error: "Only JPEG, PNG, or WebP images are allowed" }, { status: 400 });
  }

  if (!configured) {
    return NextResponse.json({ url: PLACEHOLDER, publicId: `consult-dev-${Date.now()}` });
  }

  const base64 = `data:${mime};base64,${buffer.toString("base64")}`;

  try {
    const uploaded = await cloudinary.uploader.upload(base64, {
      folder: "prudential-atelier/consultations",
      transformation: [{ width: 1200, crop: "limit" }, { quality: "auto" }],
    });
    return NextResponse.json({ url: uploaded.secure_url, publicId: uploaded.public_id });
  } catch (e) {
    console.error("[consultations/upload]", e);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
