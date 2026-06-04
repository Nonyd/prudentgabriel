import { NextRequest, NextResponse } from "next/server";
import { cloudinary } from "@/lib/cloudinary";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

function isFileLike(v: unknown): v is Blob & { name?: string } {
  return typeof v === "object" && v !== null && typeof (v as Blob).arrayBuffer === "function";
}

export async function POST(req: NextRequest) {
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

  const mime = raw.type || "application/octet-stream";
  if (!ALLOWED.has(mime)) {
    return NextResponse.json({ error: "Only JPG, PNG, WebP, or PDF files are allowed" }, { status: 400 });
  }

  if (raw.size > MAX_BYTES) {
    return NextResponse.json({ error: "File must be 5MB or smaller" }, { status: 400 });
  }

  if (!configured) {
    return NextResponse.json({ url: `https://placehold.co/receipt-${Date.now()}.png` });
  }

  const buffer = Buffer.from(await raw.arrayBuffer());
  const base64 = `data:${mime};base64,${buffer.toString("base64")}`;

  try {
    const uploaded = await cloudinary.uploader.upload(base64, {
      folder: "prudential-atelier/receipts",
      resource_type: mime === "application/pdf" ? "raw" : "image",
    });
    return NextResponse.json({ url: uploaded.secure_url, publicId: uploaded.public_id });
  } catch (e) {
    console.error("[upload/receipt]", e);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
