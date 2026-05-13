import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin-auth";
import { deleteOrdersByIds } from "@/lib/order-delete";

const bodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});

export async function POST(req: NextRequest) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const deleted = await deleteOrdersByIds(parsed.data.ids);
    return NextResponse.json({ ok: true, deleted });
  } catch (e) {
    console.error("[admin/orders/bulk-delete]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Delete failed" },
      { status: e instanceof Error && e.message.includes("Maximum") ? 400 : 500 },
    );
  }
}
