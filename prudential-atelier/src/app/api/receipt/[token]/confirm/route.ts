import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { confirmBespokeReceipt, ReceiptConfirmError } from "@/lib/bespoke-receipt";
import { prisma } from "@/lib/prisma";
import { createClientNotification } from "@/lib/customer-notifications";

type Params = { params: Promise<{ token: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await auth();
  const { token } = await params;

  // Guest with token: require login so we know who confirmed (receiptConfirmedById).
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Please sign in to confirm receipt", loginRequired: true },
      { status: 401 },
    );
  }

  try {
    const result = await confirmBespokeReceipt({
      token,
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
    console.error("[receipt/confirm]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params;
  const order = await prisma.bespokeOrder.findUnique({
    where: { receiptConfirmToken: token },
    select: {
      id: true,
      orderRef: true,
      clientName: true,
      status: true,
      receiptConfirmedAt: true,
      deliveredAt: true,
    },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ order });
}
