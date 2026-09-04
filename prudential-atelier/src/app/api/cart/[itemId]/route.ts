import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { removeCartLine, updateCartLineQty, changeCartLineSize } from "@/lib/cart-service";

const patchSchema = z.object({
  quantity: z.number().int().min(1).optional(),
  variantId: z.string().min(1).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { itemId: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success || (!parsed.data.quantity && !parsed.data.variantId)) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (parsed.data.variantId) {
    const sized = await changeCartLineSize(session.user.id, params.itemId, parsed.data.variantId);
    if (!sized.ok) {
      return NextResponse.json({ error: sized.error }, { status: sized.status });
    }
    if (parsed.data.quantity && parsed.data.quantity !== sized.cartItem.quantity) {
      const qty = await updateCartLineQty(session.user.id, sized.cartItem.id, parsed.data.quantity);
      if (!qty.ok) {
        return NextResponse.json({ error: qty.error }, { status: qty.status });
      }
      return NextResponse.json(qty.cartItem);
    }
    return NextResponse.json(sized.cartItem);
  }

  const result = await updateCartLineQty(session.user.id, params.itemId, parsed.data.quantity!);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.cartItem);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { itemId: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await removeCartLine(session.user.id, params.itemId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ success: true });
}
