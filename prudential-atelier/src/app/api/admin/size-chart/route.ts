import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-auth";

const rowSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1),
  sortOrder: z.number().int(),
  bustCm: z.number().positive(),
  waistCm: z.number().positive(),
  hipCm: z.number().positive(),
  lengthCm: z.number().positive().optional().nullable(),
});

export async function GET() {
  const gate = await requireAdminApi("shop.products");
  if (!gate.ok) return gate.response;
  const chart = await prisma.sizeChart.findFirst({
    where: { isDefault: true },
    include: { rows: { orderBy: { sortOrder: "asc" } } },
  });
  return NextResponse.json(chart);
}

export async function PUT(req: NextRequest) {
  const gate = await requireAdminApi("shop.products");
  if (!gate.ok) return gate.response;
  const parsed = z.object({ rows: z.array(rowSchema).min(1) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const chart = await prisma.sizeChart.findFirst({ where: { isDefault: true } });
  if (!chart) return NextResponse.json({ error: "No house chart" }, { status: 404 });
  await prisma.$transaction(async (tx) => {
    await tx.sizeChartRow.deleteMany({ where: { chartId: chart.id } });
    for (const row of parsed.data.rows) {
      await tx.sizeChartRow.create({
        data: {
          chartId: chart.id,
          label: row.label,
          sortOrder: row.sortOrder,
          bustCm: row.bustCm,
          waistCm: row.waistCm,
          hipCm: row.hipCm,
          lengthCm: row.lengthCm ?? null,
        },
      });
    }
    await tx.sizeChart.update({ where: { id: chart.id }, data: { updatedAt: new Date() } });
  });
  const next = await prisma.sizeChart.findUnique({
    where: { id: chart.id },
    include: { rows: { orderBy: { sortOrder: "asc" } } },
  });
  return NextResponse.json(next);
}
