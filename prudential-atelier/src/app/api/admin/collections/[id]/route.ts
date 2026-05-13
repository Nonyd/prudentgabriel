import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-auth";
import { collectionAdminPatchSchema } from "@/validations/collection";
import { slugifyText } from "@/lib/utils";
import { collectionListProductInclude, mapProductToListItemWithMeta } from "@/lib/collection-products";
import { revalidateCollection } from "@/lib/revalidate";
import { revalidatePath } from "next/cache";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  const collection = await prisma.collection.findUnique({
    where: { id },
    include: {
      products: {
        orderBy: { sortOrder: "asc" },
        include: {
          product: { include: collectionListProductInclude },
        },
      },
    },
  });

  if (!collection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { products: cpRows, ...collectionFields } = collection;
  const manualAssignments = cpRows.map((cp) => ({
    id: cp.id,
    collectionId: cp.collectionId,
    productId: cp.productId,
    sortOrder: cp.sortOrder,
    createdAt: cp.createdAt.toISOString(),
    product: mapProductToListItemWithMeta(cp.product),
  }));

  return NextResponse.json({
    collection: {
      ...collectionFields,
      createdAt: collectionFields.createdAt.toISOString(),
      updatedAt: collectionFields.updatedAt.toISOString(),
      manualAssignments,
    },
  });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = collectionAdminPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;
  const data: Prisma.CollectionUpdateInput = {};

  if (d.name !== undefined) data.name = d.name.trim();
  if (d.slug !== undefined) data.slug = slugifyText(d.slug);
  if (d.description !== undefined) data.description = d.description?.trim() || null;
  if (d.excerpt !== undefined) data.excerpt = d.excerpt?.trim() || null;
  if (d.coverImage !== undefined) {
    data.coverImage = d.coverImage === "" ? null : d.coverImage;
  }
  if (d.coverImageAlt !== undefined) data.coverImageAlt = d.coverImageAlt?.trim() || null;
  if (d.autoTag !== undefined) data.autoTag = d.autoTag?.trim() || null;
  if (d.isFeatured !== undefined) data.isFeatured = d.isFeatured;
  if (d.isPublished !== undefined) data.isPublished = d.isPublished;
  if (d.displayOrder !== undefined) data.displayOrder = d.displayOrder;
  if (d.season !== undefined) data.season = d.season?.trim() || null;
  if (d.year !== undefined) data.year = d.year;
  if (d.metaTitle !== undefined) data.metaTitle = d.metaTitle?.trim() || null;
  if (d.metaDescription !== undefined) data.metaDescription = d.metaDescription?.trim() || null;

  if (Object.keys(data).length === 0) {
    const current = await prisma.collection.findUnique({ where: { id } });
    if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(current);
  }

  try {
    const updated = await prisma.collection.update({
      where: { id },
      data,
    });
    await revalidateCollection(updated.slug);
    revalidatePath("/");
    return NextResponse.json(updated);
  } catch (e: unknown) {
    const code = typeof e === "object" && e && "code" in e ? String((e as { code: string }).code) : "";
    if (code === "P2002") {
      return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
    }
    console.error(e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  const existing = await prisma.collection.findUnique({ where: { id }, select: { slug: true } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.collection.delete({ where: { id } });
  await revalidateCollection(existing.slug);
  revalidatePath("/");
  return NextResponse.json({ ok: true });
}
