import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-auth";

const lagosSchema = z.object({
  name: z.string().min(2),
  price: z.number().min(0),
  freeAboveNGN: z.number().min(0).optional().nullable(),
  etaText: z.string().min(1),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().optional(),
});

export async function GET() {
  const gate = await requireAdminApi("settings");
  if (!gate.ok) return gate.response;
  const methods = await prisma.shippingMethod.findMany({
    include: {
      pickupLocations: { orderBy: { sortOrder: "asc" } },
      lagosLocations: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: { sortOrder: "asc" },
  });
  const packaging = await prisma.packagingProfile.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ methods, packaging });
}

export async function POST(req: NextRequest) {
  const gate = await requireAdminApi("settings");
  if (!gate.ok) return gate.response;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = lagosSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const local = await prisma.shippingMethod.findUnique({ where: { kind: "LOCAL_FLAT" } });
  if (!local) return NextResponse.json({ error: "Lagos delivery method is missing" }, { status: 500 });

  const maxSort = await prisma.lagosLocation.aggregate({ _max: { sortOrder: true } });
  const loc = await prisma.lagosLocation.create({
    data: {
      shippingMethodId: local.id,
      name: parsed.data.name,
      price: parsed.data.price,
      freeAboveNGN: parsed.data.freeAboveNGN ?? null,
      etaText: parsed.data.etaText,
      isActive: parsed.data.isActive ?? true,
      sortOrder: parsed.data.sortOrder ?? (maxSort._max.sortOrder ?? 0) + 1,
    },
  });
  return NextResponse.json(loc);
}
