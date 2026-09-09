import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { confirmBespokeReceipt, ReceiptConfirmError } from "@/lib/bespoke-receipt";
import {
  loadPublicReceipt,
  publicReceiptOmitsClientRecord,
} from "@/lib/public-receipt-payload";
import { createClientNotification } from "@/lib/customer-notifications";
import { logServerError } from "@/lib/logger";

type Params = { params: Promise<{ token: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params;
  const payload = await loadPublicReceipt(token);
  if (!payload) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!publicReceiptOmitsClientRecord(payload as unknown as Record<string, unknown>)) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
  return NextResponse.json(payload);
}

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await auth();
  const { token } = await params;
  const actor =
    session?.user?.id && (!session.user.role || session.user.role === "CUSTOMER")
      ? {
          id: session.user.id,
          role: session.user.role ?? "CUSTOMER",
          email: session.user.email,
        }
      : null;

  try {
    const result = await confirmBespokeReceipt({ token, actor });
    if (actor?.id) {
      void createClientNotification({
        userId: actor.id,
        type: "RECEIPT_CONFIRMED",
        title: "Receipt confirmed",
        message: `Thank you for confirming receipt of ${result.orderRef}.`,
        link: `/account/orders/bespoke/${result.orderId}`,
        entityId: result.orderId,
      }).catch(() => undefined);
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof ReceiptConfirmError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    await logServerError({ errorType: "RECEIPT_CONFIRM", error: e });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
