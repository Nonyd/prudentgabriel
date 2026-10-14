import { NextRequest, NextResponse } from "next/server";
import { LoyaltyTier, OrderStatus, Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireBespokeAccess } from "@/lib/atelier/bespoke-access";
import { logError } from "@/lib/logger";
import { PROTECTED_ACCOUNTS } from "@/lib/roles";
import { commissionTitle, occasionPhrase, titleDate } from "@/lib/atelier/commission-list";

const TIERS = new Set<string>(Object.values(LoyaltyTier));

/** Where a ready-to-wear order stands, for the Delivery column (it has no delivery date). */
const SHOP_STATUS_LABEL: Partial<Record<OrderStatus, string>> = {
  PENDING: "Awaiting payment",
  CONFIRMED: "Paid",
  PROCESSING: "Being prepared",
  CUTTING: "Being made",
  MAKING: "Being made",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  READY_FOR_COLLECTION: "Ready to collect",
  COLLECTED: "Collected",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

export async function GET(req: NextRequest) {
  const gate = await requireBespokeAccess("manage", { key: "clients" });
  if (!gate.ok) return gate.response;

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim();
    const tier = searchParams.get("tier");
    const filter = searchParams.get("filter");

    const where: Prisma.ClientProfileWhereInput = {};
    if (tier && tier !== "all" && TIERS.has(tier)) {
      where.loyaltyTier = tier as LoyaltyTier;
    }
    if (filter === "vip") {
      where.loyaltyTier = { in: [LoyaltyTier.GOLD, LoyaltyTier.PLATINUM] };
    } else if (filter === "active_orders") {
      where.bespokeOrders = {
        some: { status: { notIn: ["DELIVERED", "CANCELLED"] } },
      };
    } else if (filter === "no_orders") {
      where.bespokeOrders = { none: {} };
    }
    const userWhere: Prisma.UserWhereInput = {
      role: Role.CUSTOMER,
      ...(PROTECTED_ACCOUNTS.length
        ? { email: { notIn: PROTECTED_ACCOUNTS } }
        : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    where.user = userWhere;

    const items = await prisma.clientProfile.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, createdAt: true } },
        bespokeOrders: {
          select: {
            id: true,
            orderRef: true,
            currentStage: true,
            status: true,
            createdAt: true,
            clientName: true,
            title: true,
            occasionType: true,
            occasionDetails: true,
            deliveryDate: true,
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        _count: { select: { bespokeOrders: true } },
      },
    });

    // Her latest ready-to-wear order too: by her account, or by her email when she checked out
    // as a guest (many sign up after ordering). Unpaid attempts that lapsed are not orders.
    const emails = items.map((c) => c.user.email.toLowerCase());
    const shopOrders = items.length
      ? await prisma.order.findMany({
          where: {
            status: { not: OrderStatus.ABANDONED },
            OR: [
              { userId: { in: items.map((c) => c.user.id) } },
              { guestEmail: { in: emails, mode: "insensitive" } },
            ],
          },
          orderBy: { createdAt: "desc" },
          select: {
            orderNumber: true,
            userId: true,
            guestEmail: true,
            status: true,
            createdAt: true,
            items: { take: 2, select: { product: { select: { name: true } } } },
            _count: { select: { items: true } },
          },
        })
      : [];
    const latestShopFor = (userId: string, email: string) =>
      shopOrders.find((o) => o.userId === userId || o.guestEmail?.toLowerCase() === email.toLowerCase());

    // The row reads like the pipeline, in three columns: "Mrs Azazi | Birthday dress | 15 October",
    // from whichever is newer: her latest commission or her latest ready-to-wear order.
    return NextResponse.json({
      items: items.map((c) => {
        const latest = c.bespokeOrders[0];
        const shop = latestShopFor(c.user.id, c.user.email);
        const name = c.user.name?.trim() || latest?.clientName || c.user.email;
        const shopIsNewer = shop && (!latest || shop.createdAt > latest.createdAt);
        if (shop && shopIsNewer) {
          const names = shop.items.map((i) => i.product.name);
          const more = shop._count.items - names.length;
          const what = names.join(", ") + (more > 0 ? ` +${more}` : "");
          return {
            ...c,
            name,
            latestKind: "rtw" as const,
            latestTitle: `${what || shop.orderNumber} · Ready-to-wear`,
            latestDelivery: SHOP_STATUS_LABEL[shop.status] ?? shop.status.toLowerCase(),
            preview: `${name} — ${what || shop.orderNumber}`,
          };
        }
        return {
          ...c,
          name,
          latestKind: latest ? ("atelier" as const) : null,
          latestTitle: latest ? latest.title?.trim() || occasionPhrase(latest) || latest.orderRef : null,
          latestDelivery: latest ? titleDate(latest.deliveryDate) : null,
          preview: latest ? commissionTitle({ ...latest, clientName: name }).text : name,
        };
      }),
    });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "CLIENT_LIST",
      message: e instanceof Error ? e.message : "Failed to list clients",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
