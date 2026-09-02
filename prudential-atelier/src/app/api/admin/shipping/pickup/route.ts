import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-auth";

const pickupSchema = z.object({
  name: z.string().min(2),
  address: z.string().min(3),
  hours: z.string().min(1),
  instructions: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export async function POST(req: NextRequest) {
  const gate = await requireAdminApi("shop");
  if (!gate.ok) return gate.response;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = pickupSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const method = await prisma.shippingMethod.findUnique({ where: { kind: "PICKUP" } });
  if (!method) return NextResponse.json({ error: "Pickup method is missing" }, { status: 500 });

  const maxSort = await prisma.pickupLocation.aggregate({ _max: { sortOrder: true } });
  const loc = await prisma.pickupLocation.create({
    data: {
      shippingMethodId: method.id,
      name: parsed.data.name,
      address: parsed.data.address,
      hours: parsed.data.hours,
      instructions: parsed.data.instructions ?? null,
      isActive: parsed.data.isActive ?? true,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
    },
  });
  return NextResponse.json(loc);
}
