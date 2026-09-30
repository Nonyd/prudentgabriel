import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBespokeAccess } from "@/lib/atelier/bespoke-access";
import {
  OPEN_COMMISSION_WHERE,
  deliveryMonthLabel,
  deliveryMonthWhere,
  dueWindows,
  formatDeliveryMonth,
  type DeliveryMonth,
} from "@/lib/atelier/delivery-month";

/**
 * Slice BC3 — what is due this month and next: the question behind "show me
 * May's orders". Cancelled commissions are left out; delivered ones stay, marked.
 * Also counts open commissions with no delivery date yet, so none hide.
 */
export async function GET() {
  const gate = await requireBespokeAccess("read");
  if (!gate.ok) return gate.response;

  const now = new Date();
  const { thisMonth, nextMonth } = dueWindows(now);

  const load = async (month: DeliveryMonth) => {
    const items = await prisma.bespokeOrder.findMany({
      where: { ...deliveryMonthWhere(month), status: { not: "CANCELLED" } },
      orderBy: [{ deliveryDate: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        orderRef: true,
        clientName: true,
        clientProfileId: true,
        deliveryDate: true,
        currentStage: true,
        status: true,
        deliveredAt: true,
      },
    });
    return {
      month: formatDeliveryMonth(month),
      label: deliveryMonthLabel(month),
      items: items.map((o) => ({
        ...o,
        deliveryDate: o.deliveryDate?.toISOString() ?? null,
        deliveredAt: o.deliveredAt?.toISOString() ?? null,
        overdue: !o.deliveredAt && o.deliveryDate !== null && o.deliveryDate < now,
      })),
    };
  };

  const [current, next, undated] = await Promise.all([
    load(thisMonth),
    load(nextMonth),
    prisma.bespokeOrder.count({ where: { ...OPEN_COMMISSION_WHERE, deliveryDate: null } }),
  ]);

  return NextResponse.json({ thisMonth: current, nextMonth: next, undatedOpen: undated });
}
