import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { confirmBespokeReceipt, ReceiptConfirmError } from "@/lib/bespoke-receipt";
import { createClientNotification } from "@/lib/customer-notifications";

type Params = { params: Promise<{ orderId: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderId } = await params;
  try {
    const result = await confirmBespokeReceipt({
      orderId,
      actor: {
        id: session.user.id,
        role: session.user.role ?? "CUSTOMER",
        email: session.user.email,
      },
    });
    void createClientNotification({
      userId: session.user.id,
      type: "RECEIPT_CONFIRMED",
      title: "Receipt confirmed",
      message: `Thank you for confirming receipt of ${result.orderRef}.`,
      link: `/account/orders/bespoke/${result.orderId}`,
      entityId: result.orderId,
    }).catch(() => undefined);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof ReceiptConfirmError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
