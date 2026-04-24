import { NextRequest, NextResponse } from "next/server";
import { PointsType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-auth";
import { canTransitionOrder } from "@/lib/order-status";
import { awardPurchasePoints } from "@/lib/points";
import { sendOrderShippedEmail } from "@/lib/email";
import { z } from "zod";

const patchSchema = z.object({
  status: z
    .enum(["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"])
    .optional(),
  adminNotes: z.string().optional().nullable(),
  trackingNumber: z.string().optional().nullable(),
  carrier: z.string().optional().nullable(),
});

const recordRefundSchema = z.object({
  recordRefund: z.object({
    full: z.boolean(),
    amountNGN: z.number().nonnegative(),
    reason: z.string().min(1),
  }),
});

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: { include: { product: { include: { images: true } }, variant: true } },
      user: true,
      shippingZone: true,
      coupon: true,
    },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(order);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const refundTry = recordRefundSchema.safeParse(body);
  if (refundTry.success) {
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (order.paymentStatus !== "PAID") {
      return NextResponse.json({ error: "Refund can only be recorded for paid orders" }, { status: 400 });
    }
    const { full, amountNGN, reason } = refundTry.data.recordRefund;
    if (!full && amountNGN > order.total) {
      return NextResponse.json({ error: "Refund amount exceeds order total" }, { status: 400 });
    }
    const stamp = new Date().toISOString().slice(0, 10);
    const line = `\n[${stamp}] Refund recorded: ₦${Math.round(amountNGN).toLocaleString("en-NG")}. Reason: ${reason}`;
    const adminNotes = [order.adminNotes?.trim() ?? "", line].filter(Boolean).join("\n");
    const nextStatus = full ? "REFUNDED" : "PROCESSING";
    const updated = await prisma.order.update({
      where: { id },
      data: {
        paymentStatus: "REFUNDED",
        status: nextStatus,
        adminNotes,
      },
    });
    return NextResponse.json(updated);
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const nextStatus = parsed.data.status;
  if (nextStatus !== undefined && nextStatus !== order.status) {
    if (!canTransitionOrder(order.status, nextStatus)) {
      return NextResponse.json({ error: "Invalid status transition" }, { status: 400 });
    }
  }

  const userRow =
    order.userId != null
      ? await prisma.user.findUnique({
          where: { id: order.userId },
          select: { email: true, name: true },
        })
      : null;
  const email = userRow?.email ?? order.guestEmail ?? null;
  const firstName =
    userRow?.name?.split(" ")[0] ?? (order.guestName ?? "Customer").split(" ")[0] ?? "Customer";

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.order.update({
      where: { id },
      data: {
        ...(parsed.data.status ? { status: parsed.data.status } : {}),
        ...(parsed.data.adminNotes !== undefined ? { adminNotes: parsed.data.adminNotes } : {}),
        ...(parsed.data.trackingNumber !== undefined ? { trackingNumber: parsed.data.trackingNumber } : {}),
        ...(parsed.data.carrier !== undefined ? { carrier: parsed.data.carrier } : {}),
      },
    });

    if (parsed.data.status === "DELIVERED" && order.userId && order.paymentStatus === "PAID") {
      const existing = await tx.pointsTransaction.findFirst({
        where: { orderId: id, type: PointsType.EARNED_PURCHASE },
      });
      if (!existing) {
        await awardPurchasePoints(order.userId, order.total, id, tx);
      }
    }

    return row;
  });

  if (parsed.data.status === "SHIPPED" && email) {
    void sendOrderShippedEmail({
      to: email,
      firstName,
      orderNumber: order.orderNumber,
      trackingNumber: parsed.data.trackingNumber ?? updated.trackingNumber ?? undefined,
      carrier: parsed.data.carrier ?? updated.carrier ?? undefined,
      estimatedDays: undefined,
    });
  }

  return NextResponse.json(updated);
}
