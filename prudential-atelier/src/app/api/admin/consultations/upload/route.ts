import { NextRequest, NextResponse } from "next/server";
import { getMediaStore } from "@/lib/media";
import { mimeFromMagicBytes } from "@/lib/image-upload-mime";
import { rateLimitOr429 } from "@/lib/rate-limit";
import { logServerError } from "@/lib/logger";
import { gateUploadFolder } from "@/lib/media/gate-upload";
import { folderIsPrivate } from "@/lib/admin-upload-folder";

const MAX_BYTES = 5 * 1024 * 1024;
const FOLDER = "prudential-atelier/consultations";

function isFileLike(v: unknown): v is Blob & { name?: string } {
  return typeof v === "object" && v !== null && typeof (v as Blob).arrayBuffer === "function";
}

export async function POST(req: NextRequest) {
  const folderGate = await gateUploadFolder(FOLDER);
  if (!folderGate.ok) return folderGate.response;

  const limited = rateLimitOr429(req, "admin-consultations-upload", 20, 15 * 60 * 1000);
  if (limited) return limited;

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

  const fileName = "name" in raw && typeof raw.name === "string" ? raw.name : undefined;
  const buffer = Buffer.from(await raw.arrayBuffer());
  const mime = mimeFromMagicBytes(buffer);
  if (!mime || mime === "application/pdf") {
    return NextResponse.json({ error: "Only JPEG, PNG, or WebP images are allowed" }, { status: 400 });
  }

  try {
    const stored = await getMediaStore().put(buffer, {
      folder: FOLDER,
      originalName: fileName,
      mime,
      private: folderIsPrivate(FOLDER),
    });
    return NextResponse.json({ url: stored.url, publicId: stored.key });
  } catch (e) {
    await logServerError({ errorType: "ADMIN_CONSULTATION_UPLOAD", error: e });
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
