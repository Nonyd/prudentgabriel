import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { cloudinary } from "@/lib/cloudinary";

const PAGE_SIZE = 20;
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function GET(req: NextRequest) {
  const gate = await requireAdminApi();
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

  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 8MB)" }, { status: 400 });
  }

  const subfolder = (form.get("folder") as string | null)?.replace(/[^a-zA-Z0-9/_-]/g, "") || "general";
  const cloudFolder = `prudent-gabriel/${subfolder}`;

  if (!configured) {
    return NextResponse.json({ error: "Cloudinary is not configured" }, { status: 503 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = `data:${file.type};base64,${buffer.toString("base64")}`;

  try {
    const uploaded = await cloudinary.uploader.upload(base64, {
      folder: cloudFolder,
      resource_type: "image",
    });

    const item = await prisma.mediaItem.create({
      data: {
        url: uploaded.secure_url,
        publicId: uploaded.public_id,
        filename: file.name || "upload",
        mimeType: file.type,
        width: uploaded.width ?? null,
        height: uploaded.height ?? null,
        sizeBytes: uploaded.bytes ?? file.size,
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
