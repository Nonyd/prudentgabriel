import { NextRequest, NextResponse } from "next/server";
import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logActivity, logError } from "@/lib/logger";
import { BESPOKE_ROLES, requireRoles } from "@/lib/api-auth";
import { getNextStage, getPreviousStage } from "@/lib/bespoke-stages";
import { buildStageEmailData, sendBespokeStageEmail } from "@/lib/bespoke-email";
import { notifyStageAdvanced } from "@/lib/notifications";

type Params = { params: Promise<{ orderId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const gate = await requireRoles(BESPOKE_ROLES);
  if (!gate.ok) return gate.response;

  const { orderId } = await params;
  let body: { notes?: string; images?: string[]; videos?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const notes = body.notes?.trim();
  if (!notes) {
    return NextResponse.json({ error: "Stage notes are required" }, { status: 400 });
  }

  const images = Array.isArray(body.images) ? body.images : [];
  const videos = Array.isArray(body.videos) ? body.videos : [];

  try {
    const order = await prisma.bespokeOrder.findUnique({
      where: { id: orderId },
      include: { stageHistory: true },
    });
    if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const currentStage = order.currentStage;
    const prev = getPreviousStage(currentStage);
    if (prev) {
      const prevDone = order.stageHistory.some((s) => s.stage === prev);
      if (!prevDone && order.stageHistory.length > 0) {
        return NextResponse.json(
          { error: "Previous stage must be completed first" },
          { status: 400 },
        );
      }
    }

    const stageUpdate = await prisma.stageUpdate.create({
      data: {
        orderId,
        stage: currentStage,
        notes,
        images,
        videos,
        completedBy: gate.session.user.id!,
        completedByName: gate.session.user.name ?? gate.session.user.email ?? undefined,
      },
    });

    const nextStage = getNextStage(currentStage);
    const updated = await prisma.bespokeOrder.update({
      where: { id: orderId },
      data: {
        currentStage: nextStage ?? currentStage,
        status: !nextStage ? OrderStatus.DELIVERED : order.status,
      },
      include: { stageHistory: { orderBy: { completedAt: "desc" } } },
    });

    const emailData = buildStageEmailData({
      clientName: order.clientName.split(" ")[0] ?? order.clientName,
      orderRef: order.orderRef,
      stage: currentStage,
      notes,
      images,
      videos,
      trackingToken: order.trackingToken,
      deliveryDate: order.deliveryDate,
    });

    try {
      await sendBespokeStageEmail(currentStage, emailData, order.clientEmail);
      await prisma.stageUpdate.update({
        where: { id: stageUpdate.id },
        data: { emailSent: true, emailSentAt: new Date() },
      });
    } catch (emailErr) {
      console.error("[bespoke-stage-email]", emailErr);
    }

    await logActivity({
      userId: gate.session.user.id,
      userEmail: gate.session.user.email ?? undefined,
      userRole: gate.session.user.role ?? undefined,
      action: "STAGE_COMPLETE",
      module: "bespoke",
      description: `Completed stage ${currentStage} for ${order.orderRef}`,
      recordId: order.id,
      recordType: "BespokeOrder",
    });

    notifyStageAdvanced({
      orderId: order.id,
      orderRef: order.orderRef,
      stage: currentStage,
    });

    return NextResponse.json({ item: updated });
  } catch (e) {
    await logError({
      severity: "CRITICAL",
      errorType: "STAGE_COMPLETE",
      message: e instanceof Error ? e.message : "Stage completion failed",
      orderId,
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
