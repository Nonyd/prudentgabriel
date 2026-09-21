import { NextRequest, NextResponse } from "next/server";
import { rateLimitOr429 } from "@/lib/rate-limit";
import { auth } from "@/auth";
import { confirmBespokeReceipt, ReceiptConfirmError } from "@/lib/bespoke-receipt";
import {
  loadPublicReceipt,
  publicReceiptOmitsClientRecord,
} from "@/lib/public-receipt-payload";
import { createClientNotification } from "@/lib/customer-notifications";
import { logServerError } from "@/lib/logger";
import { CAPABILITY_EXPIRED_COPY } from "@/lib/capability-token";

type Params = { params: Promise<{ token: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const limited = rateLimitOr429(req, "receipt-token-view", 60, 15 * 60 * 1000);
  if (limited) return limited;

  const { token } = await params;
  const result = await loadPublicReceipt(token);
  if (!result.ok) {
    if (result.reason === "expired") {
      return NextResponse.json({ error: CAPABILITY_EXPIRED_COPY.body }, { status: 410 });
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const payload = result.payload;
  if (!publicReceiptOmitsClientRecord(payload as unknown as Record<string, unknown>)) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
  return NextResponse.json(payload);
}

export async function POST(req: NextRequest, { params }: Params) {
  const limited = rateLimitOr429(req, "receipt-token-confirm", 10, 15 * 60 * 1000);
  if (limited) return limited;

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
