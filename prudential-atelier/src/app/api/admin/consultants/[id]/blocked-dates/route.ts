import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

function parseYmdToDbDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;
  const { id } = await params;

  const blocked = await prisma.consultantBlockedDate.findMany({
    where: { consultantId: id },
    orderBy: { date: "asc" },
  });
  return NextResponse.json({ blocked });
}

const postSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const date = parseYmdToDbDate(parsed.data.date);
  const row = await prisma.consultantBlockedDate.upsert({
    where: { consultantId_date: { consultantId: id, date } },
    create: {
      consultantId: id,
      date,
      reason: parsed.data.reason ?? null,
    },
    update: { reason: parsed.data.reason ?? null },
  });
  return NextResponse.json({ blocked: row });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const ymd = searchParams.get("date");
  if (!ymd) {
    return NextResponse.json({ error: "date query required" }, { status: 400 });
  }
  const date = parseYmdToDbDate(ymd);
  await prisma.consultantBlockedDate.deleteMany({
    where: { consultantId: id, date },
  });
  return NextResponse.json({ ok: true });
}
