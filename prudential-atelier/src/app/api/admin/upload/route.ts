import { NextRequest, NextResponse } from "next/server";
import { getMediaStore } from "@/lib/media";
import { folderIsPrivate, sanitizeUploadFolder } from "@/lib/admin-upload-folder";
import { gateUploadFolder } from "@/lib/media/gate-upload";
import { mimeFromMagicBytes, mimeFromVideoMagicBytes } from "@/lib/image-upload-mime";
import { COLLECTION_REEL_FOLDER, MAX_COLLECTION_REEL_BYTES } from "@/lib/collection-reel-limits";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

function isFileLike(v: unknown): v is Blob & { name?: string } {
  return typeof v === "object" && v !== null && typeof (v as Blob).arrayBuffer === "function";
}

export async function POST(req: NextRequest) {
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
  const folderField = form.get("folder");
  const folder = sanitizeUploadFolder(
    typeof folderField === "string" ? folderField : "",
    "prudential-atelier/products",
  );
  const reelUpload = folder === COLLECTION_REEL_FOLDER;
  const maxBytes = reelUpload ? MAX_COLLECTION_REEL_BYTES : allowVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (raw.size > maxBytes) {
    return NextResponse.json(
      { error: reelUpload ? "Reel must be under 10MB" : "File is too large" },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await raw.arrayBuffer());
  const videoMime = allowVideo || reelUpload ? mimeFromVideoMagicBytes(buffer) : null;
  const isVideo = Boolean(videoMime);
  const magic = isVideo ? null : mimeFromMagicBytes(buffer, { allowPdf, allowGif: false });
  if (isVideo) {
    if (!videoMime) {
      return NextResponse.json({ error: "Unsupported video type" }, { status: 400 });
    }
    if (reelUpload && videoMime !== "video/mp4") {
      return NextResponse.json({ error: "Reels must be H.264 MP4" }, { status: 400 });
    }
  } else if (!magic) {
    return NextResponse.json(
      { error: allowPdf ? "Only JPEG, PNG, WebP, or PDF files are allowed" : "Only JPEG, PNG, or WebP images are allowed" },
      { status: 400 },
    );
  }
  const mime = isVideo ? videoMime! : magic!;

  const gate = await gateUploadFolder(folder);
  if (!gate.ok) return gate.response;

  try {
    const stored = await getMediaStore().put(buffer, {
      folder,
      originalName: fileName,
      mime,
      private: folderIsPrivate(folder),
    });
    return NextResponse.json({
      url: stored.url,
      publicId: stored.key,
      originalName: stored.originalName,
    });
  } catch (e) {
    console.error("[admin/upload]", e);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
