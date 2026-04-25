import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-auth";
import { z } from "zod";

const zoneSchema = z.object({
  name: z.string().min(2),
  countries: z.array(z.string()).min(1),
  states: z.array(z.string()).default([]),
  flatRateNGN: z.number().min(0),
  perKgNGN: z.number().min(0).default(0),
  freeAboveNGN: z.number().optional().nullable(),
  estimatedDays: z.string().min(1),
  isActive: z.boolean().default(true),
});

export async function GET() {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;
  const zones = await prisma.shippingZone.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ items: zones });
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
  const parsed = zoneSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;
  const zone = await prisma.shippingZone.create({
    data: {
      name: d.name,
      countries: d.countries,
      states: d.states,
      flatRateNGN: d.flatRateNGN,
      perKgNGN: d.perKgNGN,
      freeAboveNGN: d.freeAboveNGN ?? null,
      estimatedDays: d.estimatedDays,
      isActive: d.isActive,
    },
  });
  return NextResponse.json(zone);
}
