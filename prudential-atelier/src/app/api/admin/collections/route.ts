import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-auth";
import { collectionAdminSchema } from "@/validations/collection";
import { slugifyText } from "@/lib/utils";
import { uniqueProductCountForCollection } from "@/lib/collection-products";

export async function GET() {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const rows = await prisma.collection.findMany({
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
  });

  const counts = await Promise.all(
    rows.map((c) => uniqueProductCountForCollection(c.id, c.autoTag)),
  );

  const collections = rows.map((c, i) => ({
    ...c,
    productCount: counts[i] ?? 0,
    updatedAt: c.updatedAt.toISOString(),
    createdAt: c.createdAt.toISOString(),
  }));

  return NextResponse.json({ collections }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = collectionAdminSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;
  const slug = (d.slug?.trim() ? slugifyText(d.slug) : slugifyText(d.name)) || "collection";

  try {
    const created = await prisma.collection.create({
      data: {
        name: d.name.trim(),
        slug,
        description: d.description?.trim() || null,
        excerpt: d.excerpt?.trim() || null,
        coverImage: d.coverImage ?? null,
        coverImageAlt: d.coverImageAlt?.trim() || null,
        autoTag: d.autoTag?.trim() || null,
        isFeatured: d.isFeatured,
        isPublished: d.isPublished,
        displayOrder: d.displayOrder,
        season: d.season?.trim() || null,
        year: d.year ?? null,
        metaTitle: d.metaTitle?.trim() || null,
        metaDescription: d.metaDescription?.trim() || null,
      },
    });
    return NextResponse.json(created);
  } catch (e: unknown) {
    const code = typeof e === "object" && e && "code" in e ? String((e as { code: string }).code) : "";
    if (code === "P2002") {
      return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
    }
    console.error(e);
    return NextResponse.json({ error: "Create failed" }, { status: 500 });
  }
}
