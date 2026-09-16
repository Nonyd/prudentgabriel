import { NextResponse } from "next/server";
import { OrderStatus, Role } from "@prisma/client";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { SUGGESTED_UNITS } from "@/lib/store/ledger";

export async function GET() {
  const gate = await requireAdminApi("store");
  if (!gate.ok) return gate.response;

  const [people, commissions, shopOrders, categories] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true, role: { not: Role.CUSTOMER } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true },
      take: 200,
    }),
    prisma.bespokeOrder.findMany({
      where: { status: { not: "ARCHIVED" }, deliveredAt: null },
      orderBy: { createdAt: "desc" },
      take: 80,
      select: { id: true, orderRef: true, clientName: true },
    }),
    prisma.order.findMany({
      where: { status: { notIn: [OrderStatus.CANCELLED, OrderStatus.REFUNDED, OrderStatus.ARCHIVED] } },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: { id: true, orderNumber: true },
    }),
    prisma.itemCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, sortOrder: true },
    }),
  ]);

  return NextResponse.json({
    people: people.map((p) => ({
      id: p.id,
      name: p.name || p.email,
      email: p.email,
      role: p.role,
    })),
    commissions: commissions.map((c) => ({
      id: c.id,
      label: `${c.clientName} · ${c.orderRef}`,
      orderRef: c.orderRef,
      clientName: c.clientName,
    })),
    shopOrders: shopOrders.map((o) => ({
      id: o.id,
      label: o.orderNumber,
    })),
    categories,
    units: SUGGESTED_UNITS,
  });
}
