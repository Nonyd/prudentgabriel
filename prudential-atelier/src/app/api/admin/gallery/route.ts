import { NextRequest, NextResponse } from "next/server";
import { GalleryCategory } from "@prisma/client";
import { requireAdminApi, CMS_ADMIN_PERMISSIONS } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { getMediaStore } from "@/lib/media";
import { mimeFromMagicBytes } from "@/lib/image-upload-mime";
import { revalidateGallery } from "@/lib/revalidate";

const PAGE_DEFAULT = 30;
const MAX_BYTES = 5 * 1024 * 1024;

function parseCategory(v: string | null): GalleryCategory | null {
  const u = v?.toUpperCase();
  if (u === "ATELIER") return GalleryCategory.ATELIER;
  if (u === "BRIDAL") return GalleryCategory.BRIDAL;
  if (u === "KIDS") return GalleryCategory.KIDS;
  return null;
}

export async function GET(req: NextRequest) {
  const gate = await requireAdminApi(CMS_ADMIN_PERMISSIONS);
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(req.url);
  const category = parseCategory(searchParams.get("category"));
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? String(PAGE_DEFAULT), 10) || PAGE_DEFAULT));

  const where = category ? { category } : {};

  const [images, total] = await Promise.all([
    prisma.galleryImage.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.galleryImage.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  return NextResponse.json({ images, total, page, totalPages });
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
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  const file = raw as Blob & { name?: string };
  const fileName = typeof file.name === "string" ? file.name : undefined;

  const category = parseCategory(String(form.get("category") ?? ""));
  if (!category) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  const alt = typeof form.get("alt") === "string" ? (form.get("alt") as string).trim() || null : null;
  const caption = typeof form.get("caption") === "string" ? (form.get("caption") as string).trim() || null : null;

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File is too large" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = mimeFromMagicBytes(buffer, { allowGif: false });
  if (!mime || mime === "application/pdf") {
    return NextResponse.json({ error: "Only JPEG, PNG, or WebP" }, { status: 400 });
  }

  const folder = `prudent-gabriel/gallery/${category.toLowerCase()}`;

  try {
    const stored = await getMediaStore().put(buffer, {
      folder,
      originalName: fileName,
      mime,
      private: false,
    });
    const maxSort = await prisma.galleryImage.aggregate({
      where: { category },
      _max: { sortOrder: true },
    });
    const sortOrder = (maxSort._max.sortOrder ?? -1) + 1;

    const row = await prisma.galleryImage.create({
      data: {
        url: stored.url,
        publicId: stored.key,
        alt,
        caption,
        category,
        width: null,
        height: null,
        sortOrder,
        isPublished: true,
        uploadedBy: gate.session.user?.id ?? null,
      },
    });

    await revalidateGallery(category);
    return NextResponse.json(row);
  } catch (e) {
    console.error("[admin/gallery POST]", e);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
