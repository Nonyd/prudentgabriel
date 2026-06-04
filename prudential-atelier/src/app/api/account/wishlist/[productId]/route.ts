import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { logActivity, logError } from "@/lib/logger";

type Params = { params: Promise<{ productId: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  const { productId } = await params;

  try {
    await prisma.wishlistItem.deleteMany({
      where: { userId: gate.session.user.id!, productId },
    });

    await logActivity({
      userId: gate.session.user.id,
      action: "DELETE",
      module: "account",
      description: "Removed product from wishlist",
      recordId: productId,
      recordType: "WishlistItem",
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "ACCOUNT_WISHLIST_REMOVE",
      message: e instanceof Error ? e.message : "Failed to remove wishlist item",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
