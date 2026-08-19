import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { cloudinary } from "@/lib/cloudinary";
import { mimeFromMagicBytes, resolveVideoMimeType } from "@/lib/image-upload-mime";
import { permissionForUploadFolder, sanitizeUploadFolder } from "@/lib/admin-upload-folder";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

const PLACEHOLDER =
  "https://images.unsplash.com/photo-1519741497674-611481863552?w=1200&q=80&auto=format";

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

  const fileName = "name" in raw && typeof raw.name === "string" ? raw.name : undefined;
  const allowPdf = form.get("allowPdf") === "true";
  const allowVideo = form.get("allowVideo") === "true";
  if (raw.size > (allowVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES)) {
    return NextResponse.json({ error: "File is too large" }, { status: 400 });
  }

  const buffer = Buffer.from(await raw.arrayBuffer());
  const videoMime = allowVideo ? resolveVideoMimeType(raw.type ?? "", fileName) : null;
  const isVideo = Boolean(videoMime);
  const magic = mimeFromMagicBytes(buffer, { allowPdf, allowGif: false });
  if (isVideo) {
    if (!videoMime) {
      return NextResponse.json({ error: "Unsupported video type" }, { status: 400 });
    }
  } else if (!magic) {
    return NextResponse.json(
      { error: allowPdf ? "Only JPEG, PNG, WebP, or PDF files are allowed" : "Only JPEG, PNG, or WebP images are allowed" },
      { status: 400 },
    );
  }
  const isPdf = magic === "application/pdf";

  const folderField = form.get("folder");
  const folder = sanitizeUploadFolder(
    typeof folderField === "string" ? folderField : "",
    "prudential-atelier/products",
  );
  const needed = permissionForUploadFolder(folder);
  if (!needed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const gate = await requireAdminApi(needed);
  if (!gate.ok) return gate.response;

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

  const dataMime = isVideo ? videoMime! : magic!;
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
