import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { consultantAdminSchema } from "@/validations/consultation";

export async function GET() {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const consultants = await prisma.consultant.findMany({
    orderBy: { displayOrder: "asc" },
    include: {
      offerings: true,
      availability: true,
      _count: { select: { bookings: true } },
    },
  });

  return NextResponse.json({ consultants });
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

  const parsed = consultantAdminSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;
  if (d.offerings.length < 1) {
    return NextResponse.json({ error: "At least one offering required" }, { status: 400 });
  }

  const keys = new Set<string>();
  for (const o of d.offerings) {
    const k = `${o.sessionType}-${o.deliveryMode}`;
    if (keys.has(k)) {
      return NextResponse.json({ error: "Duplicate session type + delivery mode" }, { status: 400 });
    }
    keys.add(k);
  }

  const consultant = await prisma.$transaction(async (tx) => {
    return tx.consultant.create({
      data: {
        name: d.name,
        title: d.title,
        bio: d.bio,
        image: d.image ?? null,
        isActive: d.isActive,
        isFlagship: d.isFlagship,
        displayOrder: d.displayOrder,
        offerings: {
          create: d.offerings.map((o) => ({
            sessionType: o.sessionType,
            deliveryMode: o.deliveryMode,
            durationMinutes: o.durationMinutes,
            feeNGN: o.feeNGN,
            feeUSD: o.feeUSD ?? null,
            feeGBP: o.feeGBP ?? null,
            isActive: o.isActive,
            description: o.description ?? null,
          })),
        },
        availability: {
          create: d.availability.map((a) => ({
            dayOfWeek: a.dayOfWeek,
            startTime: a.startTime,
            endTime: a.endTime,
            isActive: a.isActive,
          })),
        },
      },
    });
  });

  return NextResponse.json({ consultant });
}
