import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { removeCartLine, updateCartLineQty } from "@/lib/cart-service";

const patchSchema = z.object({
  quantity: z.number().int().min(1),
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
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const result = await updateCartLineQty(session.user.id, params.itemId, parsed.data.quantity);
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
