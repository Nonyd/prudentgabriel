import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getMediaStore } from "@/lib/media";
import { mimeFromMagicBytes } from "@/lib/image-upload-mime";

const MAX_BYTES = 5 * 1024 * 1024;
const FOLDER = "prudential-atelier/avatars/customer";

function isFileLike(v: unknown): v is Blob & { name?: string } {
  return typeof v === "object" && v !== null && typeof (v as Blob).arrayBuffer === "function";
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
  const mime = mimeFromMagicBytes(buffer, { allowGif: false });
  if (!mime || mime === "application/pdf") {
    return NextResponse.json({ error: "Only JPEG, PNG, or WebP images are allowed" }, { status: 400 });
  }

  try {
    const stored = await getMediaStore().put(buffer, {
      folder: FOLDER,
      originalName: fileName,
      mime,
      private: false,
    });
    return NextResponse.json({
      url: stored.url,
      publicId: stored.key,
    });
  } catch (e) {
    console.error("[account/upload]", e);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
