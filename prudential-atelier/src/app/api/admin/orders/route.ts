import { NextRequest, NextResponse } from "next/server";
import { OrderStatus, PaymentGateway, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format");
  const limitRaw = Number(searchParams.get("limit") ?? "20");
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const take = format === "csv" ? Math.min(1000, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 1000)) : 20;
  const search = (searchParams.get("search") ?? "").trim();
  const status = searchParams.get("status");
  const paymentStatus = searchParams.get("paymentStatus");
  const gateway = searchParams.get("gateway");

  const where: Prisma.OrderWhereInput = {};
  if (search) {
    where.OR = [
      { orderNumber: { contains: search, mode: "insensitive" } },
      { guestEmail: { contains: search, mode: "insensitive" } },
      { user: { email: { contains: search, mode: "insensitive" } } },
    ];
  }
  if (status && status !== "all" && (Object.values(OrderStatus) as string[]).includes(status)) {
    where.status = status as OrderStatus;
  }
  if (paymentStatus && paymentStatus !== "all" && (Object.values(PaymentStatus) as string[]).includes(paymentStatus)) {
    where.paymentStatus = paymentStatus as PaymentStatus;
  }
  if (gateway && gateway !== "all" && (Object.values(PaymentGateway) as string[]).includes(gateway)) {
    where.paymentGateway = gateway as PaymentGateway;
  }

  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: format === "csv" ? 0 : (page - 1) * take,
      take,
      include: {
        user: { select: { name: true, email: true } },
        shippingZone: { select: { name: true } },
        _count: { select: { items: true } },
        items: { take: 1, include: { product: { select: { name: true } } } },
      },
    }),
  ]);

  if (format === "csv") {
    const header = [
      "Order #",
      "Customer",
      "Email",
      "Items",
      "Subtotal",
      "Shipping",
      "Discount",
      "Total",
      "Currency",
      "Gateway",
      "Payment",
      "Status",
      "Date",
    ];
    const esc = (v: unknown) => {
      const s = String(v ?? "");
      return `"${s.replace(/"/g, '""')}"`;
    };
    const lines = [
      header.map(esc).join(","),
      ...orders.map((o) => {
        const name = o.user?.name ?? o.guestName ?? "Guest";
        const email = o.user?.email ?? o.guestEmail ?? "";
        const row = [
          o.orderNumber,
          name,
          email,
          o._count.items,
          o.subtotal,
          o.shippingAmount,
          o.discount,
          o.total,
          o.currency,
          o.paymentGateway ?? "",
          o.paymentStatus,
          o.status,
          o.createdAt.toLocaleDateString("en-NG"),
        ];
        return row.map(esc).join(",");
      }),
    ];
    const csv = lines.join("\n");
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.json(
    {
      orders,
      total,
      page,
      perPage: take,
      totalPages: Math.ceil(total / take),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
