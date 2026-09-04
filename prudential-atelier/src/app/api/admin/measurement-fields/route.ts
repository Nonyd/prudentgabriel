import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-auth";
import { ensureCustomMeasurementFields } from "@/lib/measurement-catalog";

const fieldSchema = z.object({
  key: z.string().min(1).max(40).regex(/^[a-z0-9_]+$/),
  label: z.string().min(1).max(80),
  helpText: z.string().max(400).optional().nullable(),
  minCm: z.number().positive().optional().nullable(),
  maxCm: z.number().positive().optional().nullable(),
  sortOrder: z.number().int().optional(),
});

export async function GET() {
  const gate = await requireAdminApi("shop.products");
  if (!gate.ok) return gate.response;
  await ensureCustomMeasurementFields();
  const items = await prisma.measurementField.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const gate = await requireAdminApi("shop.products");
  if (!gate.ok) return gate.response;
  const parsed = fieldSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const item = await prisma.measurementField.create({
    data: {
      key: parsed.data.key,
      label: parsed.data.label,
      helpText: parsed.data.helpText ?? null,
      minCm: parsed.data.minCm ?? null,
      maxCm: parsed.data.maxCm ?? null,
      sortOrder: parsed.data.sortOrder ?? 99,
    },
  });
  return NextResponse.json(item);
}
