import { NextRequest, NextResponse } from "next/server";
import { GalleryCategory } from "@prisma/client";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { cloudinary } from "@/lib/cloudinary";

const PAGE_DEFAULT = 30;

function parseCategory(v: string | null): GalleryCategory | null {
  const u = v?.toUpperCase();
  if (u === "ATELIER") return GalleryCategory.ATELIER;
  if (u === "BRIDAL") return GalleryCategory.BRIDAL;
  return null;
}

export async function GET(req: NextRequest) {
  const gate = await requireAdminApi();
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
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const category = parseCategory(String(form.get("category") ?? ""));
  if (!category) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  const alt = typeof form.get("alt") === "string" ? (form.get("alt") as string).trim() || null : null;
  const caption = typeof form.get("caption") === "string" ? (form.get("caption") as string).trim() || null : null;

  const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (!allowed.has(file.type)) {
    return NextResponse.json({ error: "Only JPEG, PNG, or WebP" }, { status: 400 });
  }

  const folder = `prudent-gabriel/gallery/${category.toLowerCase()}`;
  const configured =
    Boolean(process.env.CLOUDINARY_API_KEY?.length) &&
    Boolean(process.env.CLOUDINARY_API_SECRET?.length) &&
    Boolean(process.env.CLOUDINARY_CLOUD_NAME?.length);

  let url: string;
  let publicId: string;
  let width: number | null = null;
  let height: number | null = null;

  if (!configured) {
    url =
      "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800&q=80&auto=format";
    publicId = `dev-gallery-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  } else {
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = `data:${file.type};base64,${buffer.toString("base64")}`;
    const uploaded = await cloudinary.uploader.upload(base64, {
      folder,
      transformation: [{ width: 1600, crop: "limit" }, { quality: "auto" }],
    });
    url = uploaded.secure_url;
    publicId = uploaded.public_id;
    width = uploaded.width ?? null;
    height = uploaded.height ?? null;
  }

  const maxSort = await prisma.galleryImage.aggregate({
    where: { category },
    _max: { sortOrder: true },
  });
  const sortOrder = (maxSort._max.sortOrder ?? -1) + 1;

  const row = await prisma.galleryImage.create({
    data: {
      url,
      publicId,
      alt,
      caption,
      category,
      width,
      height,
      sortOrder,
      isPublished: true,
      uploadedBy: gate.session.user?.id ?? null,
    },
  });

  return NextResponse.json(row);
}
