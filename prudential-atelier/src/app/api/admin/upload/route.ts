import { NextRequest, NextResponse } from "next/server";
import { ADMIN_IMPERSONATE_COOKIE } from "@/lib/admin-impersonate";
import {
  UPLOAD_ALLOW_VIDEO_HEADER,
  UPLOAD_FILENAME_HEADER,
  UPLOAD_FOLDER_HEADER,
} from "@/lib/admin-upload-headers";
import { getMediaStore } from "@/lib/media";
import { folderIsPrivate, sanitizeUploadFolder } from "@/lib/admin-upload-folder";
import { gateUploadFolder } from "@/lib/media/gate-upload";
import { HEIC_CATALOGUE_MESSAGE, isHeifMagic, mimeFromMagicBytes, mimeFromVideoMagicBytes } from "@/lib/image-upload-mime";
import { mediaPutFailureMessage } from "@/lib/media/put-error";
import {
  COLLECTION_REEL_FOLDER,
  COLLECTION_REEL_TOO_LARGE_MESSAGE,
  MAX_COLLECTION_REEL_BYTES,
} from "@/lib/collection-reel-limits";
import { logServerError } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

function isFileLike(v: unknown): v is Blob & { name?: string } {
  return typeof v === "object" && v !== null && typeof (v as Blob).arrayBuffer === "function";
}

function impersonating(req: NextRequest): boolean {
  return Boolean(req.cookies.get(ADMIN_IMPERSONATE_COOKIE)?.value);
}

function tooLargeMessage(reelUpload: boolean, allowVideo: boolean): string {
  if (reelUpload) return COLLECTION_REEL_TOO_LARGE_MESSAGE;
  if (allowVideo) return "File is too large";
  return "Image must be 5MB or smaller. Compress the photo or export JPEG.";
}

function maxBytesFor(folder: string, allowVideo: boolean): number {
  if (folder === COLLECTION_REEL_FOLDER) return MAX_COLLECTION_REEL_BYTES;
  return allowVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
}

async function persistUpload(opts: {
  buffer: Buffer;
  folder: string;
  fileName: string | undefined;
  allowPdf: boolean;
  allowVideo: boolean;
}): Promise<NextResponse> {
  const reelUpload = opts.folder === COLLECTION_REEL_FOLDER;
  const videoMime = opts.allowVideo || reelUpload ? mimeFromVideoMagicBytes(opts.buffer) : null;
  const isVideo = Boolean(videoMime);
  const magic = isVideo ? null : mimeFromMagicBytes(opts.buffer, { allowPdf: opts.allowPdf, allowGif: false });
  if (isVideo) {
    if (!videoMime) {
      return NextResponse.json({ error: "Unsupported video type" }, { status: 400 });
    }
    if (reelUpload && videoMime !== "video/mp4") {
      return NextResponse.json({ error: "Reels must be H.264 MP4" }, { status: 400 });
    }
  } else if (!magic) {
    if (isHeifMagic(opts.buffer)) {
      return NextResponse.json({ error: HEIC_CATALOGUE_MESSAGE }, { status: 400 });
    }
    return NextResponse.json(
      { error: opts.allowPdf ? "Only JPEG, PNG, WebP, or PDF files are allowed" : "Only JPEG, PNG, or WebP images are allowed" },
      { status: 400 },
    );
  }
  const mime = isVideo ? videoMime! : magic!;

  const gate = await gateUploadFolder(opts.folder);
  if (!gate.ok) return gate.response;

  try {
    const stored = await getMediaStore().put(opts.buffer, {
      folder: opts.folder,
      originalName: opts.fileName,
      mime,
      private: folderIsPrivate(opts.folder),
    });
    return NextResponse.json({
      url: stored.url,
      publicId: stored.key,
      originalName: stored.originalName,
    });
  } catch (e) {
    const code = typeof e === "object" && e !== null && "code" in e ? String((e as { code?: unknown }).code) : "";
    await logServerError({
      errorType: "ADMIN_UPLOAD",
      error: e,
      severity: code === "EACCES" || code === "EPERM" || code === "EROFS" || code === "ENOSPC" ? "CRITICAL" : "WARNING",
    });
    return NextResponse.json({ error: mediaPutFailureMessage(e) }, { status: 500 });
  }
}

async function postRawVideo(req: NextRequest): Promise<NextResponse> {
  const folder = sanitizeUploadFolder(req.headers.get(UPLOAD_FOLDER_HEADER), "prudential-atelier/products");
  const allowVideo = req.headers.get(UPLOAD_ALLOW_VIDEO_HEADER) === "true";
  const reelUpload = folder === COLLECTION_REEL_FOLDER;
  if (!allowVideo && !reelUpload) {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }
  const maxBytes = maxBytesFor(folder, true);
  const declared = Number(req.headers.get("content-length") || "0");
  if (declared > maxBytes) {
    return NextResponse.json({ error: tooLargeMessage(reelUpload, true) }, { status: 400 });
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(await req.arrayBuffer());
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }
  if (buffer.byteLength > maxBytes) {
    return NextResponse.json({ error: tooLargeMessage(reelUpload, true) }, { status: 400 });
  }

  let fileName: string | undefined;
  const rawName = req.headers.get(UPLOAD_FILENAME_HEADER);
  if (rawName) {
    try {
      fileName = decodeURIComponent(rawName);
    } catch {
      fileName = rawName;
    }
  }

  return persistUpload({
    buffer,
    folder,
    fileName,
    allowPdf: false,
    allowVideo: true,
  });
}

async function postMultipart(req: NextRequest): Promise<NextResponse> {
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
  const folder = sanitizeUploadFolder(
    typeof form.get("folder") === "string" ? String(form.get("folder")) : "",
    "prudential-atelier/products",
  );
  const reelUpload = folder === COLLECTION_REEL_FOLDER;
  const maxBytes = maxBytesFor(folder, allowVideo);
  if (raw.size > maxBytes) {
    return NextResponse.json({ error: tooLargeMessage(reelUpload, allowVideo) }, { status: 400 });
  }

  const buffer = Buffer.from(await raw.arrayBuffer());
  return persistUpload({ buffer, folder, fileName, allowPdf, allowVideo });
}

export async function POST(req: NextRequest) {
  if (impersonating(req)) {
    return NextResponse.json({ error: "View as user is read-only." }, { status: 403 });
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.startsWith("multipart/form-data")) {
    return postMultipart(req);
  }
  return postRawVideo(req);
}
