import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { sendAbandonedCheckoutReminder } from "@/lib/checkout-session";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdminApi("shop.orders");
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  const result = await sendAbandonedCheckoutReminder({ sessionId: id, kind: "manual" });
  if (!result.queued) {
    const status = result.reason === "not_found" ? 404 : 409;
    return NextResponse.json(
      { error: result.reason ?? "Could not send", queued: false },
      { status },
    );
  }
  return NextResponse.json({
    ok: true,
    created: result.created,
    warning: result.warning ?? null,
  });
}
