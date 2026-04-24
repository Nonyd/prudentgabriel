import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { cloudinary } from "@/lib/cloudinary";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE = new Set(["image/jpeg", "image/png", "image/webp"]);

const PLACEHOLDER =
  "https://images.unsplash.com/photo-1519741497674-611481863552?w=1200&q=80&auto=format";

export async function POST(req: NextRequest) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

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

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file field" }, { status: 400 });
  }

  const allowPdf = form.get("allowPdf") === "true";
  const isPdf = file.type === "application/pdf";
  if (allowPdf && isPdf) {
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "PDF must be 5MB or smaller" }, { status: 400 });
    }
  } else if (!ALLOWED_IMAGE.has(file.type)) {
    return NextResponse.json({ error: "Only JPEG, PNG, or WebP images are allowed" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image must be 5MB or smaller" }, { status: 400 });
  }

  if (!configured) {
    return NextResponse.json({
      url: isPdf ? "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf" : PLACEHOLDER,
      publicId: `dev-${Date.now()}`,
    });
  }

  const folderField = form.get("folder");
  const folder =
    typeof folderField === "string" && folderField.trim().length > 0
      ? folderField.replace(/[^a-zA-Z0-9/_-]/g, "").slice(0, 120)
      : "prudential-atelier/products";

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = `data:${file.type};base64,${buffer.toString("base64")}`;

  try {
    const uploaded = await cloudinary.uploader.upload(base64, {
      folder,
      resource_type: isPdf ? "raw" : "image",
      ...(isPdf ? {} : { transformation: [{ width: 1200, crop: "limit" }, { quality: "auto" }] }),
    });
    return NextResponse.json({
      url: uploaded.secure_url,
      publicId: uploaded.public_id,
    });
  } catch (e) {
    console.error("[admin/upload]", e);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
