import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/api-auth";
import { getOrCreateClientProfile } from "@/lib/account-helpers";
import { prisma } from "@/lib/prisma";
import { PUBLIC_PRODUCT_WHERE } from "@/lib/product-visibility";
import { logActivity, logError } from "@/lib/logger";

export async function GET() {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  try {
    const profile = await getOrCreateClientProfile(gate.session.user.id!);
    const items = await prisma.wishlistItem.findMany({
      // A withdrawn piece drops out of the wishlist.
      where: { userId: gate.session.user.id!, product: PUBLIC_PRODUCT_WHERE },
      include: {
        product: {
          include: {
            images: { orderBy: { sortOrder: "asc" }, take: 1 },
            variants: { orderBy: { sortOrder: "asc" } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ items, clientId: profile.id });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "ACCOUNT_WISHLIST",
      message: e instanceof Error ? e.message : "Failed to get wishlist",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

const addSchema = z.object({ productId: z.string().min(1) });

export async function POST(req: NextRequest) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const product = await prisma.product.findFirst({
      where: { id: parsed.data.productId, ...PUBLIC_PRODUCT_WHERE },
      select: { id: true },
    });
    if (!product) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const item = await prisma.wishlistItem.upsert({
      where: {
        userId_productId: {
          userId: gate.session.user.id!,
          productId: parsed.data.productId,
        },
      },
      create: { userId: gate.session.user.id!, productId: parsed.data.productId },
      update: {},
      include: { product: { select: { id: true, name: true, slug: true } } },
    });

    await logActivity({
      userId: gate.session.user.id,
      action: "CREATE",
      module: "account",
      description: `Added product to wishlist`,
      recordId: item.id,
      recordType: "WishlistItem",
    });

    return NextResponse.json({ item });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "ACCOUNT_WISHLIST_ADD",
      message: e instanceof Error ? e.message : "Failed to add wishlist item",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
