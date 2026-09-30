import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBespokeAccess } from "@/lib/atelier/bespoke-access";
import { featureKeyFromLabel } from "@/lib/atelier/construction-features";
import { logActivity } from "@/lib/logger";

/**
 * Slice BC2 — the house's library of construction features. Read by anyone who
 * works on commissions; defined by managers. New features need no deploy.
 */

const createSchema = z.object({
  label: z.string().trim().min(1).max(80),
  key: z.string().trim().min(1).max(40).regex(/^[a-z0-9_]+$/).optional(),
  group: z.string().trim().max(40).optional().nullable(),
  helpText: z.string().trim().max(400).optional().nullable(),
  sortOrder: z.number().int().optional(),
});

export async function GET(req: NextRequest) {
  const gate = await requireBespokeAccess("read");
  if (!gate.ok) return gate.response;
  const includeArchived = new URL(req.url).searchParams.get("archived") === "1";
  const items = await prisma.constructionFeature.findMany({
    where: includeArchived ? {} : { archivedAt: null },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    include: { _count: { select: { commissions: true } } },
  });
  return NextResponse.json({
    items: items.map(({ _count, ...f }) => ({ ...f, commissionCount: _count.commissions })),
  });
}

export async function POST(req: NextRequest) {
  const gate = await requireBespokeAccess("manage");
  if (!gate.ok) return gate.response;
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const key = parsed.data.key ?? featureKeyFromLabel(parsed.data.label);
  if (!key) return NextResponse.json({ error: "The name needs a letter or number" }, { status: 400 });
  const clash = await prisma.constructionFeature.findUnique({ where: { key } });
  if (clash) {
    return NextResponse.json(
      {
        error: clash.archivedAt
          ? "That feature exists but is retired. Restore it instead."
          : "That feature already exists",
      },
      { status: 409 },
    );
  }

  const last = await prisma.constructionFeature.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const item = await prisma.constructionFeature.create({
    data: {
      key,
      label: parsed.data.label,
      group: parsed.data.group || null,
      helpText: parsed.data.helpText || null,
      sortOrder: parsed.data.sortOrder ?? (last?.sortOrder ?? 0) + 10,
    },
  });
  await logActivity({
    userId: gate.session.user.id,
    userEmail: gate.session.user.email ?? undefined,
    userRole: gate.session.user.role ?? undefined,
    action: "CREATE",
    module: "bespoke",
    description: `Added construction feature "${item.label}"`,
    recordId: item.id,
    recordType: "ConstructionFeature",
  });
  return NextResponse.json({ item }, { status: 201 });
}
