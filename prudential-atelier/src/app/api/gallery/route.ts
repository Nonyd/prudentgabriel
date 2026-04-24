import { NextRequest, NextResponse } from "next/server";
import { GalleryCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const LIMIT_DEFAULT = 50;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const catRaw = searchParams.get("category")?.toUpperCase();
  const category =
    catRaw === "BRIDAL" ? GalleryCategory.BRIDAL : catRaw === "ATELIER" ? GalleryCategory.ATELIER : null;
  if (!category) {
    return NextResponse.json({ error: "category must be ATELIER or BRIDAL" }, { status: 400 });
  }

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? String(LIMIT_DEFAULT), 10) || LIMIT_DEFAULT));

  const where = { isPublished: true, category };

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
  const hasMore = page < totalPages;

  return NextResponse.json(
    { images, total, page, totalPages, hasMore },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}
