import { NextRequest, NextResponse } from "next/server";
import { ProductCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-auth";
import { couponAdminSchema } from "@/validations/coupon";

export async function GET() {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;
  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ items: coupons });
}

export async function POST(req: NextRequest) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = couponAdminSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;
  const scope = (d.categoryScope ?? [])
    .map((c) => c as ProductCategory)
    .filter((c) => (Object.values(ProductCategory) as string[]).includes(c));

  const exists = await prisma.coupon.findUnique({ where: { code: d.code } });
  if (exists) {
    return NextResponse.json({ error: "A coupon with this code already exists" }, { status: 409 });
  }

  try {
    const c = await prisma.coupon.create({
      data: {
        code: d.code,
        description: d.description ?? null,
        type: d.type,
        value: d.value,
        minOrderNGN: d.minOrderNGN ?? null,
        maxUsesTotal: d.maxUsesTotal ?? null,
        maxUsesPerUser: d.maxUsesPerUser,
        appliesToAll: d.appliesToAll,
        categoryScope: d.appliesToAll ? [] : scope,
        isActive: d.isActive,
        startsAt: d.startsAt ?? new Date(),
        expiresAt: d.expiresAt ?? null,
      },
    });
    return NextResponse.json(c);
  } catch {
    return NextResponse.json({ error: "Could not create coupon" }, { status: 500 });
  }
}
