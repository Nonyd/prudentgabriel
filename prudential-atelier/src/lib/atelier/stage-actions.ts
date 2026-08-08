import {
  BespokeStage,
  OrderStatus,
  Role,
  StageApprovalStatus,
  StageMediaKind,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/logger";
import { getNextStage, STAGE_ORDER, STAGE_SHORT_LABELS } from "@/lib/bespoke-stages";
import { buildStageEmailData, sendBespokeStageEmail } from "@/lib/bespoke-email";
import { notifyStageAdvanced, createNotification } from "@/lib/notifications";
import {
  notifyClientBespokeStageComplete,
  createClientNotification,
  resolveUserIdByEmail,
} from "@/lib/customer-notifications";
import { notifyStaffOrderUpdate } from "@/lib/staff-notifications";
import { sendStageApprovalRequestEmail, sendStageChangesRequestedEmail } from "@/lib/email";
import { getPublicAppUrl } from "@/lib/app-url";
import {
  canCompleteStage,
  evaluateRevert,
  type StageGateActor,
  type StageGateResult,
} from "@/lib/atelier/can-complete-stage";
import { getStageRequirement } from "@/lib/atelier/stage-requirements";

export type StageActionActor = StageGateActor & {
  email?: string | null;
  name?: string | null;
};

function actorName(actor: StageActionActor): string {
  return actor.name?.trim() || actor.email || "Staff";
}

export async function saveStageDraft(params: {
  orderId: string;
  stage: BespokeStage;
  notes: string;
  actorId?: string | null;
}): Promise<void> {
  const notes = params.notes.trim();
  if (!notes) {
    await prisma.orderStageDraft.deleteMany({
      where: { orderId: params.orderId, stage: params.stage },
    });
    return;
  }
  await prisma.orderStageDraft.upsert({
    where: { orderId_stage: { orderId: params.orderId, stage: params.stage } },
    create: {
      orderId: params.orderId,
      stage: params.stage,
      notes,
      updatedById: params.actorId ?? null,
    },
    update: { notes, updatedById: params.actorId ?? null },
  });
}

export async function addStageMedia(params: {
  orderId: string;
  stage: BespokeStage;
  urls: string[];
  kind?: StageMediaKind;
  uploadedById?: string | null;
}): Promise<number> {
  const urls = params.urls.map((u) => u.trim()).filter(Boolean);
  if (!urls.length) return 0;
  await prisma.orderStageMedia.createMany({
    data: urls.map((url) => ({
      orderId: params.orderId,
      stage: params.stage,
      url,
      kind: params.kind ?? StageMediaKind.IMAGE,
      uploadedById: params.uploadedById ?? null,
    })),
  });
  return urls.length;
}

export async function completeOrderStage(params: {
  orderId: string;
  actor: StageActionActor;
  notes?: string | null;
  images?: string[];
  videos?: string[];
}): Promise<{ ok: true; orderId: string } | { ok: false; status: number; failures: StageGateResult["failures"] }> {
  const order = await prisma.bespokeOrder.findUnique({
    where: { id: params.orderId },
    select: {
      id: true,
      orderRef: true,
      currentStage: true,
      status: true,
      clientName: true,
      clientEmail: true,
      clientProfileId: true,
      trackingToken: true,
      deliveryDate: true,
    },
  });
  if (!order) {
    return {
      ok: false,
      status: 404,
      failures: [{ code: "WRONG_STAGE", message: "Order not found." }],
    };
  }

  const stage = order.currentStage;
  if (params.notes?.trim()) {
    await saveStageDraft({
      orderId: order.id,
      stage,
      notes: params.notes,
      actorId: params.actor.id,
    });
  }
  if (params.images?.length) {
    await addStageMedia({
      orderId: order.id,
      stage,
      urls: params.images,
      kind: StageMediaKind.IMAGE,
      uploadedById: params.actor.id,
    });
  }
  if (params.videos?.length) {
    await addStageMedia({
      orderId: order.id,
      stage,
      urls: params.videos,
      kind: StageMediaKind.VIDEO,
      uploadedById: params.actor.id,
    });
  }

  const gate = await canCompleteStage({
    orderId: order.id,
    stage,
    actor: params.actor,
    notes: params.notes,
    mode: "complete",
  });
  if (!gate.ok || !gate.snapshot) {
    return { ok: false, status: gate.snapshot ? 422 : 404, failures: gate.failures };
  }

  const notes = gate.snapshot.notes ?? "";
  const media = await prisma.orderStageMedia.findMany({
    where: { orderId: order.id, stage },
    orderBy: { createdAt: "asc" },
    select: { url: true, kind: true },
  });
  const images = media.filter((m) => m.kind === StageMediaKind.IMAGE).map((m) => m.url);
  const videos = media.filter((m) => m.kind === StageMediaKind.VIDEO).map((m) => m.url);

  const nextStage = getNextStage(stage);

  const stageUpdate = await prisma.$transaction(async (tx) => {
    const update = await tx.stageUpdate.create({
      data: {
        orderId: order.id,
        stage,
        notes,
        images,
        videos,
        completedBy: params.actor.id,
        completedByName: actorName(params.actor),
      },
    });
    const activeCompletion = await tx.orderStageCompletion.findFirst({
      where: { orderId: order.id, stage, revertedAt: null },
    });
    if (activeCompletion) {
      await tx.orderStageCompletion.update({
        where: { id: activeCompletion.id },
        data: {
          completedAt: new Date(),
          completedById: params.actor.id,
          notes,
        },
      });
    } else {
      await tx.orderStageCompletion.create({
        data: {
          orderId: order.id,
          stage,
          completedById: params.actor.id,
          notes,
        },
      });
    }
    await tx.orderStageDraft.deleteMany({ where: { orderId: order.id, stage } });
    await tx.bespokeOrder.update({
      where: { id: order.id },
      data: {
        currentStage: nextStage ?? stage,
        status: !nextStage ? OrderStatus.DELIVERED : order.status,
      },
    });
    return update;
  });

  const emailData = buildStageEmailData({
    clientName: order.clientName.split(" ")[0] ?? order.clientName,
    orderRef: order.orderRef,
    stage,
    notes,
    images,
    videos,
    trackingToken: order.trackingToken,
    deliveryDate: order.deliveryDate,
  });

  try {
    await sendBespokeStageEmail(stage, emailData, order.clientEmail);
    await prisma.stageUpdate.update({
      where: { id: stageUpdate.id },
      data: { emailSent: true, emailSentAt: new Date() },
    });
  } catch (emailErr) {
    console.error("[bespoke-stage-email]", emailErr);
  }

  await logActivity({
    userId: params.actor.id,
    userEmail: params.actor.email ?? undefined,
    userRole: params.actor.role ? String(params.actor.role) : undefined,
    action: "STAGE_COMPLETE",
    module: "bespoke",
    description: `Completed stage ${stage} for ${order.orderRef}`,
    recordId: order.id,
    recordType: "BespokeOrder",
  });

  notifyStageAdvanced({
    orderId: order.id,
    orderRef: order.orderRef,
    stage,
  });

  notifyClientBespokeStageComplete({
    orderId: order.id,
    orderRef: order.orderRef,
    stage,
    trackingToken: order.trackingToken,
    clientProfileId: order.clientProfileId,
    clientEmail: order.clientEmail,
  });

  return { ok: true, orderId: order.id };
}

export async function revertOrderStage(params: {
  orderId: string;
  targetStage: BespokeStage;
  reason: string;
  actor: StageActionActor;
}): Promise<{ ok: true } | { ok: false; status: number; failures: StageGateResult["failures"] }> {
  const order = await prisma.bespokeOrder.findUnique({
    where: { id: params.orderId },
    select: { id: true, orderRef: true, currentStage: true },
  });
  if (!order) {
    return {
      ok: false,
      status: 404,
      failures: [{ code: "WRONG_STAGE", message: "Order not found." }],
    };
  }

  const gate = evaluateRevert({
    currentStage: order.currentStage,
    targetStage: params.targetStage,
    actor: params.actor,
    reason: params.reason,
  });
  if (!gate.ok) {
    const forbidden = gate.failures.some((f) => f.code === "REVERT_FORBIDDEN");
    return { ok: false, status: forbidden ? 403 : 422, failures: gate.failures };
  }

  const targetIdx = STAGE_ORDER.indexOf(params.targetStage);
  const toClear = STAGE_ORDER.slice(targetIdx);
  const approvalStages = toClear.filter((s) => getStageRequirement(s).requiresClientApproval);
  const reason = params.reason.trim();
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.orderStageCompletion.updateMany({
      where: { orderId: order.id, stage: { in: toClear }, revertedAt: null },
      data: {
        revertedAt: now,
        revertedById: params.actor.id,
        revertReason: reason,
      },
    });
    if (approvalStages.length) {
      await tx.stageApproval.updateMany({
        where: {
          orderId: order.id,
          stage: { in: approvalStages },
          status: { not: StageApprovalStatus.SUPERSEDED },
        },
        data: { status: StageApprovalStatus.SUPERSEDED },
      });
    }
    await tx.bespokeOrder.update({
      where: { id: order.id },
      data: {
        currentStage: params.targetStage,
        status: OrderStatus.PROCESSING,
      },
    });
  });

  await logActivity({
    userId: params.actor.id,
    userEmail: params.actor.email ?? undefined,
    userRole: params.actor.role ? String(params.actor.role) : undefined,
    action: "STAGE_REVERT",
    module: "bespoke",
    description: `Reverted ${order.orderRef} from ${order.currentStage} to ${params.targetStage}: ${reason}`,
    recordId: order.id,
    recordType: "BespokeOrder",
  });

  return { ok: true };
}

export async function requestStageApproval(params: {
  orderId: string;
  actor: StageActionActor;
  notes?: string | null;
  images?: string[];
  videos?: string[];
}): Promise<{ ok: true; approvalId: string } | { ok: false; status: number; failures: StageGateResult["failures"] }> {
  const order = await prisma.bespokeOrder.findUnique({
    where: { id: params.orderId },
    select: {
      id: true,
      orderRef: true,
      currentStage: true,
      clientName: true,
      clientEmail: true,
      clientProfileId: true,
    },
  });
  if (!order) {
    return {
      ok: false,
      status: 404,
      failures: [{ code: "WRONG_STAGE", message: "Order not found." }],
    };
  }

  const req = getStageRequirement(order.currentStage);
  if (!req.requiresClientApproval) {
    return {
      ok: false,
      status: 422,
      failures: [
        {
          code: "CLIENT_APPROVAL_PENDING",
          message: `${STAGE_SHORT_LABELS[order.currentStage]} does not require client approval.`,
        },
      ],
    };
  }

  if (params.notes?.trim()) {
    await saveStageDraft({
      orderId: order.id,
      stage: order.currentStage,
      notes: params.notes,
      actorId: params.actor.id,
    });
  }
  if (params.images?.length) {
    await addStageMedia({
      orderId: order.id,
      stage: order.currentStage,
      urls: params.images,
      kind: StageMediaKind.IMAGE,
      uploadedById: params.actor.id,
    });
  }
  if (params.videos?.length) {
    await addStageMedia({
      orderId: order.id,
      stage: order.currentStage,
      urls: params.videos,
      kind: StageMediaKind.VIDEO,
      uploadedById: params.actor.id,
    });
  }

  const gate = await canCompleteStage({
    orderId: order.id,
    stage: order.currentStage,
    actor: params.actor,
    notes: params.notes,
    mode: "request_approval",
  });
  if (!gate.ok || !gate.snapshot) {
    return { ok: false, status: gate.snapshot ? 422 : 404, failures: gate.failures };
  }

  const existingPending = await prisma.stageApproval.findFirst({
    where: { orderId: order.id, stage: order.currentStage, status: StageApprovalStatus.PENDING },
  });
  if (existingPending) {
    return { ok: true, approvalId: existingPending.id };
  }

  const approval = await prisma.stageApproval.create({
    data: {
      orderId: order.id,
      stage: order.currentStage,
      status: StageApprovalStatus.PENDING,
      requestedById: params.actor.id,
    },
  });

  const approveUrl = `${getPublicAppUrl()}/account/orders/bespoke/${order.id}`;
  const media = await prisma.orderStageMedia.findMany({
    where: { orderId: order.id, stage: order.currentStage },
    orderBy: { createdAt: "asc" },
    select: { url: true },
  });

  await sendStageApprovalRequestEmail({
    to: order.clientEmail,
    clientName: order.clientName,
    orderRef: order.orderRef,
    stageLabel: STAGE_SHORT_LABELS[order.currentStage],
    notes: gate.snapshot.notes,
    imageUrls: media.map((m) => m.url),
    approveUrl,
  }).catch((e) => console.error("[stage-approval-email]", e));

  const userId =
    (order.clientProfileId
      ? (await prisma.clientProfile.findUnique({
          where: { id: order.clientProfileId },
          select: { userId: true },
        }))?.userId
      : null) ?? (await resolveUserIdByEmail(order.clientEmail));

  if (userId) {
    await createClientNotification({
      userId,
      type: "STAGE_APPROVAL_REQUESTED",
      title: "Please review your commission",
      message: `${order.orderRef} — ${STAGE_SHORT_LABELS[order.currentStage]} is ready for your approval.`,
      link: `/account/orders/bespoke/${order.id}`,
      entityId: approval.id,
    }).catch(() => {});
  }

  await logActivity({
    userId: params.actor.id,
    userEmail: params.actor.email ?? undefined,
    userRole: params.actor.role ? String(params.actor.role) : undefined,
    action: "STAGE_APPROVAL_REQUEST",
    module: "bespoke",
    description: `Requested client approval for ${order.orderRef} (${order.currentStage})`,
    recordId: order.id,
    recordType: "BespokeOrder",
  });

  return { ok: true, approvalId: approval.id };
}

export async function respondToStageApproval(params: {
  orderId: string;
  approvalId: string;
  clientUserId: string;
  clientEmail: string;
  decision: "APPROVED" | "CHANGES_REQUESTED";
  comment?: string | null;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const approval = await prisma.stageApproval.findFirst({
    where: { id: params.approvalId, orderId: params.orderId },
    include: {
      order: {
        select: {
          id: true,
          orderRef: true,
          clientEmail: true,
          clientProfileId: true,
          currentStage: true,
          assignments: {
            where: { completedAt: null },
            include: { staffProfile: { select: { userId: true, user: { select: { email: true, name: true } } } } },
          },
        },
      },
    },
  });
  if (!approval) return { ok: false, status: 404, error: "Approval not found." };
  if (approval.status !== StageApprovalStatus.PENDING) {
    return { ok: false, status: 409, error: "This approval has already been responded to." };
  }

  const emailMatch =
    approval.order.clientEmail.trim().toLowerCase() === params.clientEmail.trim().toLowerCase();
  const profile = approval.order.clientProfileId
    ? await prisma.clientProfile.findUnique({
        where: { id: approval.order.clientProfileId },
        select: { userId: true },
      })
    : null;
  if (!emailMatch && profile?.userId !== params.clientUserId) {
    return { ok: false, status: 403, error: "Forbidden." };
  }

  const comment = params.comment?.trim() || null;
  if (params.decision === "CHANGES_REQUESTED" && !comment) {
    return { ok: false, status: 400, error: "Please describe the changes you would like." };
  }

  await prisma.stageApproval.update({
    where: { id: approval.id },
    data: {
      status:
        params.decision === "APPROVED"
          ? StageApprovalStatus.APPROVED
          : StageApprovalStatus.CHANGES_REQUESTED,
      respondedAt: new Date(),
      clientComment: comment,
    },
  });

  const stageLabel = STAGE_SHORT_LABELS[approval.stage];

  if (params.decision === "CHANGES_REQUESTED") {
    const staffTargets = new Map<string, { email: string | null; name: string | null }>();
    for (const a of approval.order.assignments) {
      staffTargets.set(a.staffProfile.userId, {
        email: a.staffProfile.user.email,
        name: a.staffProfile.user.name,
      });
    }
    for (const [userId, staff] of Array.from(staffTargets.entries())) {
      notifyStaffOrderUpdate({
        userId,
        orderId: approval.order.id,
        orderRef: approval.order.orderRef,
        title: "Client requested changes",
        message: `${approval.order.orderRef} — ${stageLabel}: ${comment}`,
      });
      if (staff.email) {
        void sendStageChangesRequestedEmail({
          to: staff.email,
          staffName: staff.name ?? "there",
          orderRef: approval.order.orderRef,
          stageLabel,
          comment: comment ?? "",
          orderUrl: `${getPublicAppUrl()}/admin/bespoke/${approval.order.id}`,
        }).catch(() => {});
      }
    }
    void createNotification({
      type: "STAGE_APPROVAL_RESPONSE",
      title: "Client requested changes",
      message: `${approval.order.orderRef} — ${stageLabel}: ${comment}`,
      link: `/admin/bespoke/${approval.order.id}`,
      entityId: approval.order.id,
    }).catch(() => {});
  } else {
    void createNotification({
      type: "STAGE_APPROVAL_RESPONSE",
      title: "Client approved stage",
      message: `${approval.order.orderRef} — ${stageLabel} approved.`,
      link: `/admin/bespoke/${approval.order.id}`,
      entityId: approval.order.id,
    }).catch(() => {});
  }

  return { ok: true };
}

export function actorFromSession(session: {
  user?: { id?: string | null; role?: string | null; email?: string | null; name?: string | null };
}): StageActionActor | null {
  const id = session.user?.id;
  if (!id) return null;
  return {
    id,
    role: (session.user?.role as Role | undefined) ?? null,
    email: session.user?.email ?? null,
    name: session.user?.name ?? null,
  };
}
