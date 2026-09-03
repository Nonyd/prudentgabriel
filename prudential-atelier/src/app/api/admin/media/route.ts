import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, CMS_ADMIN_PERMISSIONS } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { getMediaStore } from "@/lib/media";
import { mimeFromMagicBytes } from "@/lib/image-upload-mime";
import { sanitizeUploadFolder } from "@/lib/admin-upload-folder";

const PAGE_SIZE = 20;
const MAX_BYTES = 5 * 1024 * 1024;

export async function GET(req: NextRequest) {
  const gate = await requireAdminApi(CMS_ADMIN_PERMISSIONS);
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(req.url);
  const folder = searchParams.get("folder")?.trim();
  const search = searchParams.get("search")?.trim();
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const where = {
    ...(folder && folder !== "all" ? { folder: { contains: folder, mode: "insensitive" as const } } : {}),
    ...(search
      ? { filename: { contains: search, mode: "insensitive" as const } }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.mediaItem.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.mediaItem.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return NextResponse.json({ items, total, page, totalPages });
}

export async function POST(req: NextRequest) {
  const gate = await requireAdminApi(CMS_ADMIN_PERMISSIONS);
  if (!gate.ok) return gate.response;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const raw = form.get("file");
  const isBlob = typeof raw === "object" && raw !== null && typeof (raw as Blob).arrayBuffer === "function";
  if (!isBlob) {
    return NextResponse.json({ error: "Missing file field" }, { status: 400 });
  }
  const file = raw as Blob & { name?: string };
  const fileName = typeof file.name === "string" ? file.name : undefined;

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = mimeFromMagicBytes(buffer, { allowGif: true });
  if (!mime || mime === "application/pdf") {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }

  const subfolder = sanitizeUploadFolder(form.get("folder"), "general");
  const cloudFolder = `prudent-gabriel/${subfolder}`;

  try {
    const stored = await getMediaStore().put(buffer, {
      folder: cloudFolder,
      originalName: fileName,
      mime,
      private: false,
    });

    const item = await prisma.mediaItem.create({
      data: {
        url: stored.url,
        publicId: stored.key,
        filename: stored.originalName,
        mimeType: mime,
        width: null,
        height: null,
        sizeBytes: stored.bytes,
        folder: cloudFolder,
        uploadedBy: gate.session.user!.id!,
      },
    });

    return NextResponse.json(item);
  } catch (e) {
    console.error("[admin/media POST]", e);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
