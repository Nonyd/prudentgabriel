import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBespokeAccess } from "@/lib/atelier/bespoke-access";
import { featureKeyFromLabel } from "@/lib/atelier/construction-features";
import { logActivity } from "@/lib/logger";

/**
 * Slice BD1 — what kind of garment a commission is: "wedding dress",
 * "traditional outfit", "dress", and whatever the house adds. Same shape and
 * gates as BC2's construction features; new types need no deploy.
 */

const createSchema = z.object({
  label: z.string().trim().min(1).max(60),
  sortOrder: z.number().int().optional(),
});

export async function GET(req: NextRequest) {
  const gate = await requireBespokeAccess("read");
  if (!gate.ok) return gate.response;
  const includeArchived = new URL(req.url).searchParams.get("archived") === "1";
  const items = await prisma.garmentType.findMany({
    where: includeArchived ? {} : { archivedAt: null },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    include: { _count: { select: { commissions: true } } },
  });
  return NextResponse.json({
    items: items.map(({ _count, ...g }) => ({ ...g, commissionCount: _count.commissions })),
  });
}

export async function POST(req: NextRequest) {
  const gate = await requireBespokeAccess("manage");
  if (!gate.ok) return gate.response;
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const key = featureKeyFromLabel(parsed.data.label);
  if (!key) return NextResponse.json({ error: "The name needs a letter or number" }, { status: 400 });
  const clash = await prisma.garmentType.findUnique({ where: { key } });
  if (clash) {
    return NextResponse.json(
      { error: clash.archivedAt ? "That type exists but is retired. Restore it instead." : "That type already exists" },
      { status: 409 },
    );
  }
  const last = await prisma.garmentType.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  const item = await prisma.garmentType.create({
    data: { key, label: parsed.data.label, sortOrder: parsed.data.sortOrder ?? (last?.sortOrder ?? 0) + 10 },
  });
  await logActivity({
    userId: gate.session.user.id,
    userEmail: gate.session.user.email ?? undefined,
    userRole: gate.session.user.role ?? undefined,
    action: "CREATE",
    module: "bespoke",
    description: `Added garment type "${item.label}"`,
    recordId: item.id,
    recordType: "GarmentType",
  });
  return NextResponse.json({ item }, { status: 201 });
}
