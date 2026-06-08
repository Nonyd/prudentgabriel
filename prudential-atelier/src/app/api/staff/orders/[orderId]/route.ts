import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ orderId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderId } = await ctx.params;
  const staff = await prisma.staffProfile.findUnique({ where: { userId: session.user.id } });
  if (!staff) return NextResponse.json({ error: "Staff profile not found" }, { status: 404 });

  const assignment = await prisma.orderAssignment.findFirst({
    where: { orderId, staffProfileId: staff.id },
  });
  if (!assignment) {
    return NextResponse.json({ error: "You are not assigned to this order" }, { status: 403 });
  }

  const order = await prisma.bespokeOrder.findUnique({
    where: { id: orderId },
    include: {
      materials: true,
      stageHistory: { orderBy: { completedAt: "desc" }, take: 5 },
      clientProfile: {
        include: {
          measurements: true,
        },
      },
    },
  });

  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const clientFirstName = order.clientName.split(/\s+/)[0] ?? order.clientName;
  const m = order.clientProfile?.measurements;
  const measurements = m
    ? {
        bust: m.bust,
        waist: m.waist,
        hips: m.hips,
        shoulderWidth: m.shoulderWidth,
        sleeveLength: m.sleeveLength,
        dressLength: m.dressLength,
        thigh: m.thigh,
        inseam: m.inseam,
        neck: m.neck,
        armhole: m.armhole,
        unit: m.unit,
        notes: m.notes,
      }
    : null;
  const stageNotes = order.stageHistory
    .filter((s) => s.notes)
    .map((s) => ({ stage: s.stage, notes: s.notes, completedAt: s.completedAt.toISOString() }));
  const images = order.stageHistory.flatMap((s) => s.images);

  return NextResponse.json({
    orderRef: order.orderRef,
    outfitDescription: order.outfitDescription,
    occasionType: order.occasionType,
    occasionDetails: order.occasionDetails,
    outfitBrief: order.outfitBrief ?? order.sessionNotes,
    moodboardImages: order.moodboardImages ?? [],
    deliveryDate: order.deliveryDate?.toISOString() ?? null,
    currentStage: order.currentStage,
    assignment: {
      role: assignment.role,
      assignedAt: assignment.assignedAt.toISOString(),
    },
    clientFirstName,
    measurements,
    materials: order.materials.map((m) => ({
      name: m.name,
      quantity: m.quantity,
      notes: m.notes,
    })),
    stageNotes,
    images,
  });
}
