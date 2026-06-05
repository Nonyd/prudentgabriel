import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { cloudinary } from "@/lib/cloudinary";
import { resolveImageMimeType, resolveVideoMimeType } from "@/lib/image-upload-mime";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

const PLACEHOLDER =
  "https://images.unsplash.com/photo-1519741497674-611481863552?w=1200&q=80&auto=format";

function isFileLike(v: unknown): v is Blob & { name?: string } {
  return typeof v === "object" && v !== null && typeof (v as Blob).arrayBuffer === "function";
}

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

  const raw = form.get("file");
  if (!isFileLike(raw)) {
    return NextResponse.json({ error: "Missing file field" }, { status: 400 });
  }

  const fileName = "name" in raw && typeof raw.name === "string" ? raw.name : undefined;
  const allowPdf = form.get("allowPdf") === "true";
  const allowVideo = form.get("allowVideo") === "true";
  const isPdf = raw.type === "application/pdf";
  const videoMime = allowVideo ? resolveVideoMimeType(raw.type ?? "", fileName) : null;
  const isVideo = Boolean(videoMime);

  if (isVideo) {
    if (raw.size > MAX_VIDEO_BYTES) {
      return NextResponse.json({ error: "Video must be 50MB or smaller" }, { status: 400 });
    }
  } else if (allowPdf && isPdf) {
    if (raw.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "PDF must be 5MB or smaller" }, { status: 400 });
    }
  } else {
    const mime = resolveImageMimeType(raw.type ?? "", fileName, { allowGif: false });
    if (!mime) {
      return NextResponse.json({ error: "Only JPEG, PNG, or WebP images are allowed" }, { status: 400 });
    }
    if (raw.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Image must be 5MB or smaller" }, { status: 400 });
    }
  }

  if (!configured) {
    return NextResponse.json({
      url: isPdf
        ? "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
        : isVideo
          ? "https://res.cloudinary.com/demo/video/upload/sample.mp4"
          : PLACEHOLDER,
      publicId: `dev-${Date.now()}`,
    });
  }

  const folderField = form.get("folder");
  const folder =
    typeof folderField === "string" && folderField.trim().length > 0
      ? folderField.replace(/[^a-zA-Z0-9/_-]/g, "").slice(0, 120)
      : "prudential-atelier/products";

  const buffer = Buffer.from(await raw.arrayBuffer());
  const dataMime = isVideo
    ? videoMime!
    : isPdf
      ? "application/pdf"
      : resolveImageMimeType(raw.type ?? "", fileName, { allowGif: false })!;
  const base64 = `data:${dataMime};base64,${buffer.toString("base64")}`;

  try {
    const uploaded = await cloudinary.uploader.upload(base64, {
      folder,
      resource_type: isVideo ? "video" : isPdf ? "raw" : "image",
      ...(isPdf || isVideo ? {} : { transformation: [{ width: 1200, crop: "limit" }, { quality: "auto" }] }),
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
