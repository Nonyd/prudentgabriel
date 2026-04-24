import { NextRequest, NextResponse } from "next/server";
import { ConsultationStatus } from "@prisma/client";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { consultantAdminSchema } from "@/validations/consultation";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;
  const { id } = await params;

  const consultant = await prisma.consultant.findUnique({
    where: { id },
    include: {
      offerings: true,
      availability: true,
      blockedDates: true,
      _count: { select: { bookings: true } },
    },
  });
  if (!consultant) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ consultant });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;
  const { id } = await params;

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

  await prisma.$transaction(async (tx) => {
    await tx.consultant.update({
      where: { id },
      data: {
        name: d.name,
        title: d.title,
        bio: d.bio,
        image: d.image ?? null,
        isActive: d.isActive,
        isFlagship: d.isFlagship,
        displayOrder: d.displayOrder,
      },
    });

    const existingOfferings = await tx.consultantOffering.findMany({ where: { consultantId: id } });
    const incomingIds = new Set(d.offerings.map((o) => o.id).filter(Boolean) as string[]);

    for (const ex of existingOfferings) {
      if (!incomingIds.has(ex.id)) {
        const cnt = await tx.consultationBooking.count({
          where: {
            offeringId: ex.id,
            status: { in: [ConsultationStatus.CONFIRMED, ConsultationStatus.PENDING_CONFIRMATION] },
          },
        });
        if (cnt === 0) {
          await tx.consultantOffering.delete({ where: { id: ex.id } });
        }
      }
    }

    for (const o of d.offerings) {
      if (o.id) {
        await tx.consultantOffering.update({
          where: { id: o.id, consultantId: id },
          data: {
            sessionType: o.sessionType,
            deliveryMode: o.deliveryMode,
            durationMinutes: o.durationMinutes,
            feeNGN: o.feeNGN,
            feeUSD: o.feeUSD ?? null,
            feeGBP: o.feeGBP ?? null,
            isActive: o.isActive,
            description: o.description ?? null,
          },
        });
      } else {
        await tx.consultantOffering.create({
          data: {
            consultantId: id,
            sessionType: o.sessionType,
            deliveryMode: o.deliveryMode,
            durationMinutes: o.durationMinutes,
            feeNGN: o.feeNGN,
            feeUSD: o.feeUSD ?? null,
            feeGBP: o.feeGBP ?? null,
            isActive: o.isActive,
            description: o.description ?? null,
          },
        });
      }
    }

    await tx.consultantAvailability.deleteMany({ where: { consultantId: id } });
    await tx.consultantAvailability.createMany({
      data: d.availability.map((a) => ({
        consultantId: id,
        dayOfWeek: a.dayOfWeek,
        startTime: a.startTime,
        endTime: a.endTime,
        isActive: a.isActive,
      })),
    });
  });

  const consultant = await prisma.consultant.findUnique({
    where: { id },
    include: { offerings: true, availability: true, blockedDates: true },
  });
  return NextResponse.json({ consultant });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;
  const { id } = await params;

  const active = await prisma.consultationBooking.count({
    where: {
      consultantId: id,
      status: { in: [ConsultationStatus.CONFIRMED, ConsultationStatus.PENDING_CONFIRMATION] },
    },
  });
  if (active > 0) {
    return NextResponse.json({ error: "Consultant has active bookings" }, { status: 409 });
  }

  await prisma.consultant.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
