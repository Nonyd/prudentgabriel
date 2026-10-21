import { provenEmail } from "@/lib/email-verification";
import {
  BespokeStage,
  OrderStageStatus,
  OrderStatus,
  Role,
  StageApprovalStatus,
  StageMediaKind,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { INTERACTIVE_TX } from "@/lib/prisma-tx";
import { logActivity, logServerError } from "@/lib/logger";
import { userHasAdminAccess } from "@/lib/login-paths";
import { buildStageEmailData, sendBespokeStageEmail } from "@/lib/bespoke-email";
import { notifyStageAdvanced, createNotification } from "@/lib/notifications";
import {
  notifyClientBespokeStageComplete,
  createClientNotification,
  resolveUserIdByEmail,
  resolveUserIdForBespoke,
} from "@/lib/customer-notifications";
import { customerAllowsPref } from "@/lib/account-helpers";
import { notifyStaffOrderUpdate } from "@/lib/staff-notifications";
import { sendStageApprovalRequestEmail, sendStageChangesRequestedEmail, sendBespokeDeliveredEmail } from "@/lib/email";
import { getPublicAppUrl } from "@/lib/app-url";
import {
  canCompleteStage,
  evaluateRevert,
  type StageGateActor,
  type StageGateResult,
} from "@/lib/atelier/can-complete-stage";
import {
  startBlockers,
  stepLabel,
  stepRequirement,
  stepsToActivate,
  visibleSteps,
} from "@/lib/atelier/pipeline";
import { loadSteps, resolveStep, syncLeadStage } from "@/lib/atelier/pipeline-db";
import {
  CAPABILITY_TTL_MS,
  CAPABILITY_EXPIRED_COPY,
  generateCapabilityToken,
} from "@/lib/capability-token";
import {
  ensureReceiptConfirmRaw,
  ensureTrackingRaw,
  findStageApprovalByPublicToken,
} from "@/lib/capability-token-lookup";

export type StageActionActor = StageGateActor & {
  email?: string | null;
  name?: string | null;
};

function actorName(actor: StageActionActor): string {
  return actor.name?.trim() || actor.email || "Staff";
}

type StepRef = { id: string; stage: BespokeStage };

function notFound(message = "Order not found.") {
  return { ok: false as const, status: 404, failures: [{ code: "WRONG_STAGE" as const, message }] };
}

export async function saveStageDraft(params: {
  orderId: string;
  step: StepRef;
  notes: string;
  actorId?: string | null;
}): Promise<void> {
  const notes = params.notes.trim();
  if (!notes) {
    await prisma.orderStageDraft.deleteMany({
      where: { orderId: params.orderId, orderStageId: params.step.id },
    });
    return;
  }
  await prisma.orderStageDraft.upsert({
    where: { orderStageId: params.step.id },
    create: {
      orderId: params.orderId,
      orderStageId: params.step.id,
      stage: params.step.stage,
      notes,
      updatedById: params.actorId ?? null,
    },
    update: { notes, updatedById: params.actorId ?? null },
  });
}

export async function addStageMedia(params: {
  orderId: string;
  step: StepRef;
  urls: string[];
  kind?: StageMediaKind;
  uploadedById?: string | null;
}): Promise<number> {
  const urls = params.urls.map((u) => u.trim()).filter(Boolean);
  if (!urls.length) return 0;
  await prisma.orderStageMedia.createMany({
    data: urls.map((url) => ({
      orderId: params.orderId,
      orderStageId: params.step.id,
      stage: params.step.stage,
      url,
      kind: params.kind ?? StageMediaKind.IMAGE,
      uploadedById: params.uploadedById ?? null,
    })),
  });
  return urls.length;
}

/** Notes and media sent with an action, saved against the step first. */
async function saveSubmitted(params: {
  orderId: string;
  step: StepRef;
  actor: StageActionActor;
  notes?: string | null;
  images?: string[];
  videos?: string[];
}): Promise<void> {
  if (params.notes?.trim()) {
    await saveStageDraft({ orderId: params.orderId, step: params.step, notes: params.notes, actorId: params.actor.id });
  }
  if (params.images?.length) {
    await addStageMedia({
      orderId: params.orderId,
      step: params.step,
      urls: params.images,
      kind: StageMediaKind.IMAGE,
      uploadedById: params.actor.id,
    });
  }
  if (params.videos?.length) {
    await addStageMedia({
      orderId: params.orderId,
      step: params.step,
      urls: params.videos,
      kind: StageMediaKind.VIDEO,
      uploadedById: params.actor.id,
    });
  }
}

export async function completeOrderStage(params: {
  orderId: string;
  /** The step to complete. Omitted: the lead step, as before steps could run side by side. */
  orderStageId?: string | null;
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
      status: true,
      clientName: true,
      clientEmail: true,
      clientProfileId: true,
      trackingToken: true,
      trackingTokenEnc: true,
      deliveryDate: true,
      productionUnlockedAt: true,
    },
  });
  if (!order) return notFound();
  if (order.status === OrderStatus.ARCHIVED) {
    return {
      ok: false,
      status: 400,
      failures: [{ code: "WRONG_STAGE", message: "Archived orders are read-only." }],
    };
  }

  const step = await resolveStep(prisma, order.id, params.orderStageId);
  if (!step) return notFound("Step not found.");
  const stage = step.stage;
  const label = stepLabel(step);
  await saveSubmitted({
    orderId: order.id,
    step,
    actor: params.actor,
    notes: params.notes,
    images: params.images,
    videos: params.videos,
  });

  const gate = await canCompleteStage({
    orderId: order.id,
    orderStageId: step.id,
    actor: params.actor,
    notes: params.notes,
    mode: "complete",
  });
  if (!gate.ok || !gate.snapshot) {
    return { ok: false, status: gate.snapshot ? 422 : 404, failures: gate.failures };
  }

  const notes = gate.snapshot.notes ?? "";
  const media = await prisma.orderStageMedia.findMany({
    where: { orderStageId: step.id },
    orderBy: { createdAt: "asc" },
    select: { url: true, kind: true },
  });
  const images = media.filter((m) => m.kind === StageMediaKind.IMAGE).map((m) => m.url);
  const videos = media.filter((m) => m.kind === StageMediaKind.VIDEO).map((m) => m.url);

  // Delivery comes last (the gate makes sure of it), so completing it delivers the order.
  const isDeliveryComplete = stage === BespokeStage.DELIVERY;
  const now = new Date();

  const stageUpdate = await prisma.$transaction(async (tx) => {
    const update = await tx.stageUpdate.create({
      data: {
        orderId: order.id,
        orderStageId: step.id,
        stage,
        notes,
        images,
        videos,
        completedBy: params.actor.id,
        completedByName: actorName(params.actor),
      },
    });
    const activeCompletion = await tx.orderStageCompletion.findFirst({
      where: { orderStageId: step.id, revertedAt: null },
    });
    if (activeCompletion) {
      await tx.orderStageCompletion.update({
        where: { id: activeCompletion.id },
        data: {
          completedAt: now,
          completedById: params.actor.id,
          notes,
        },
      });
    } else {
      await tx.orderStageCompletion.create({
        data: {
          orderId: order.id,
          orderStageId: step.id,
          stage,
          completedById: params.actor.id,
          notes,
        },
      });
    }
    await tx.orderStageDraft.deleteMany({ where: { orderStageId: step.id } });
    await tx.orderStage.update({ where: { id: step.id }, data: { status: OrderStageStatus.DONE } });

    // While other steps are still running nothing new starts; otherwise the next one does.
    const after = await loadSteps(tx, order.id);
    const toStart = stepsToActivate(after, Boolean(order.productionUnlockedAt));
    if (toStart.length) {
      await tx.orderStage.updateMany({
        where: { id: { in: toStart } },
        data: { status: OrderStageStatus.ACTIVE, startedAt: now, startedById: params.actor.id },
      });
    }
    await syncLeadStage(tx, order.id);
    if (isDeliveryComplete) {
      await tx.bespokeOrder.update({
        where: { id: order.id },
        data: { status: OrderStatus.DELIVERED, deliveredAt: now },
      });
    }
    return update;
  }, INTERACTIVE_TX);

  const refreshed = isDeliveryComplete
    ? await prisma.bespokeOrder.findUnique({
        where: { id: order.id },
        select: {
          id: true,
          receiptConfirmToken: true,
          receiptConfirmTokenEnc: true,
          receiptConfirmTokenExpiresAt: true,
        },
      })
    : null;

  const trackingRaw = await ensureTrackingRaw({
    id: order.id,
    trackingToken: order.trackingToken,
    trackingTokenEnc: order.trackingTokenEnc,
  });

  if (isDeliveryComplete && refreshed?.receiptConfirmToken) {
    const expiresAt =
      refreshed.receiptConfirmTokenExpiresAt ??
      new Date(Date.now() + CAPABILITY_TTL_MS.receiptConfirm);
    if (!refreshed.receiptConfirmTokenExpiresAt) {
      await prisma.bespokeOrder.update({
        where: { id: refreshed.id },
        data: { receiptConfirmTokenExpiresAt: expiresAt },
      });
    }

    const receiptRaw = await ensureReceiptConfirmRaw({
      id: refreshed.id,
      receiptConfirmToken: refreshed.receiptConfirmToken,
      receiptConfirmTokenEnc: refreshed.receiptConfirmTokenEnc,
      receiptConfirmTokenExpiresAt: expiresAt,
    });
    const base = getPublicAppUrl().replace(/\/+$/, "");
    const confirmUrl = `${base}/receipt/${receiptRaw}`;
    const accountUrl = `${base}/account/orders/bespoke/${order.id}`;
    try {
      await sendBespokeDeliveredEmail({
        to: order.clientEmail,
        firstName: order.clientName.split(" ")[0] ?? order.clientName,
        orderRef: order.orderRef,
        confirmUrl,
        accountUrl,
      });
      await prisma.stageUpdate.update({
        where: { id: stageUpdate.id },
        data: { emailSent: true, emailSentAt: new Date() },
      });
    } catch (emailErr) {
      await logServerError({ errorType: "BESPOKE_DELIVERY_EMAIL", error: emailErr });
    }
  } else {
    const emailData = buildStageEmailData({
      clientName: order.clientName.split(" ")[0] ?? order.clientName,
      orderRef: order.orderRef,
      stage,
      stageName: label,
      stageNumber: visibleSteps(await loadSteps(prisma, order.id)).find((s) => s.id === step.id)?.number,
      notes,
      images,
      videos,
      trackingToken: trackingRaw,
      deliveryDate: order.deliveryDate,
    });

    try {
      const prefUserId = await resolveUserIdForBespoke(order.clientProfileId, order.clientEmail);
      const wantsStage = prefUserId ? await customerAllowsPref(prefUserId, "orderStage") : true;
      if (wantsStage) {
        await sendBespokeStageEmail(stage, emailData, order.clientEmail, step.id);
        await prisma.stageUpdate.update({
          where: { id: stageUpdate.id },
          data: { emailSent: true, emailSentAt: new Date() },
        });
      }
    } catch (emailErr) {
      await logServerError({ errorType: "BESPOKE_STAGE_EMAIL", error: emailErr });
    }
  }

  await logActivity({
    userId: params.actor.id,
    userEmail: params.actor.email ?? undefined,
    userRole: params.actor.role ? String(params.actor.role) : undefined,
    action: "STAGE_COMPLETE",
    module: "bespoke",
    description: `Completed stage ${label} for ${order.orderRef}`,
    recordId: order.id,
    recordType: "BespokeOrder",
  });

  notifyStageAdvanced({
    orderId: order.id,
    orderRef: order.orderRef,
    stage: label,
  });

  notifyClientBespokeStageComplete({
    orderId: order.id,
    orderRef: order.orderRef,
    stage,
    stageLabel: label,
    trackingToken: trackingRaw,
    clientProfileId: order.clientProfileId,
    clientEmail: order.clientEmail,
  });

  return { ok: true, orderId: order.id };
}

export async function revertOrderStage(params: {
  orderId: string;
  /** The done step to reopen. */
  orderStageId: string;
  reason: string;
  actor: StageActionActor;
}): Promise<
  { ok: true; currentStage: BespokeStage } | { ok: false; status: number; failures: StageGateResult["failures"] }
> {
  const order = await prisma.bespokeOrder.findUnique({
    where: { id: params.orderId },
    select: { id: true, orderRef: true, status: true },
  });
  if (!order) return notFound();
  if (order.status === OrderStatus.ARCHIVED) {
    return {
      ok: false,
      status: 400,
      failures: [{ code: "WRONG_STAGE", message: "Archived orders are read-only." }],
    };
  }
  const step = await resolveStep(prisma, order.id, params.orderStageId);
  if (!step) return notFound("Step not found.");

  const gate = evaluateRevert({ step, actor: params.actor, reason: params.reason });
  if (!gate.ok) {
    const forbidden = gate.failures.some((f) => f.code === "REVERT_FORBIDDEN");
    return { ok: false, status: forbidden ? 403 : 422, failures: gate.failures };
  }

  const reason = params.reason.trim();
  const now = new Date();

  const currentStage = await prisma.$transaction(async (tx) => {
    await tx.orderStageCompletion.updateMany({
      where: { orderStageId: step.id, revertedAt: null },
      data: {
        revertedAt: now,
        revertedById: params.actor.id,
        revertReason: reason,
      },
    });
    if (stepRequirement(step).requiresClientApproval) {
      await tx.stageApproval.updateMany({
        where: { orderStageId: step.id, status: { not: StageApprovalStatus.SUPERSEDED } },
        data: { status: StageApprovalStatus.SUPERSEDED },
      });
    }
    await tx.orderStage.update({
      where: { id: step.id },
      data: { status: OrderStageStatus.ACTIVE, startedAt: now, startedById: params.actor.id },
    });
    // Only this step reopens. Steps running that needed it done go back to waiting;
    // other done steps keep their completions.
    const steps = await loadSteps(tx, order.id);
    const waiting = steps.filter(
      (s) =>
        s.id !== step.id &&
        s.status === OrderStageStatus.ACTIVE &&
        startBlockers({
          step: { ...s, status: OrderStageStatus.PENDING },
          steps,
          productionUnlocked: true,
          alongside: false,
        }).length > 0,
    );
    if (waiting.length) {
      await tx.orderStage.updateMany({
        where: { id: { in: waiting.map((s) => s.id) } },
        data: { status: OrderStageStatus.PENDING, startedAt: null, startedById: null },
      });
    }
    const lead = await syncLeadStage(tx, order.id);
    await tx.bespokeOrder.update({
      where: { id: order.id },
      data: { status: OrderStatus.PROCESSING },
    });
    return lead;
  }, INTERACTIVE_TX);

  await logActivity({
    userId: params.actor.id,
    userEmail: params.actor.email ?? undefined,
    userRole: params.actor.role ? String(params.actor.role) : undefined,
    action: "STAGE_REVERT",
    module: "bespoke",
    description: `Reopened ${stepLabel(step)} on ${order.orderRef}: ${reason}`,
    recordId: order.id,
    recordType: "BespokeOrder",
  });

  return { ok: true, currentStage };
}

export function stageApprovalPublicUrl(publicToken: string): string {
  return `${getPublicAppUrl()}/approve/${publicToken}`;
}

export async function requestStageApproval(params: {
  orderId: string;
  /** The step to ask about. Omitted: the lead step. */
  orderStageId?: string | null;
  actor: StageActionActor;
  notes?: string | null;
  images?: string[];
  videos?: string[];
}): Promise<
  | { ok: true; approvalId: string; approval: { id: string; stage: BespokeStage; status: StageApprovalStatus; requestedAt: Date; publicToken: string } }
  | { ok: false; status: number; failures: StageGateResult["failures"] }
> {
  const order = await prisma.bespokeOrder.findUnique({
    where: { id: params.orderId },
    select: {
      id: true,
      orderRef: true,
      clientName: true,
      clientEmail: true,
      clientProfileId: true,
    },
  });
  if (!order) return notFound();
  const step = await resolveStep(prisma, order.id, params.orderStageId);
  if (!step) return notFound("Step not found.");
  const label = stepLabel(step);

  const req = stepRequirement(step);
  if (!req.requiresClientApproval) {
    return {
      ok: false,
      status: 422,
      failures: [
        {
          code: "CLIENT_APPROVAL_PENDING",
          message: `${label} does not require client approval.`,
        },
      ],
    };
  }

  await saveSubmitted({
    orderId: order.id,
    step,
    actor: params.actor,
    notes: params.notes,
    images: params.images,
    videos: params.videos,
  });

  const gate = await canCompleteStage({
    orderId: order.id,
    orderStageId: step.id,
    actor: params.actor,
    notes: params.notes,
    mode: "request_approval",
  });
  if (!gate.ok || !gate.snapshot) {
    return { ok: false, status: gate.snapshot ? 422 : 404, failures: gate.failures };
  }

  const existingPending = await prisma.stageApproval.findFirst({
    where: { orderStageId: step.id, status: StageApprovalStatus.PENDING },
  });
  if (existingPending) {
    return { ok: true, approvalId: existingPending.id, approval: existingPending };
  }

  const stageTok = generateCapabilityToken();
  const approval = await prisma.stageApproval.create({
    data: {
      orderId: order.id,
      orderStageId: step.id,
      stage: step.stage,
      status: StageApprovalStatus.PENDING,
      requestedById: params.actor.id,
      publicToken: stageTok.hash,
      publicTokenEnc: stageTok.enc,
      publicTokenExpiresAt: new Date(Date.now() + CAPABILITY_TTL_MS.stageApproval),
    },
  });

  const approveUrl = stageApprovalPublicUrl(stageTok.raw);
  const media = await prisma.orderStageMedia.findMany({
    where: { orderStageId: step.id },
    orderBy: { createdAt: "asc" },
    select: { url: true },
  });

  await sendStageApprovalRequestEmail({
    to: order.clientEmail,
    clientName: order.clientName,
    orderRef: order.orderRef,
    stageLabel: label,
    notes: gate.snapshot.notes,
    imageUrls: media.map((m) => m.url),
    approveUrl,
    approvalId: approval.id,
  }).catch((e) => {
    void logServerError({ errorType: "STAGE_APPROVAL_EMAIL", error: e });
  });

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
      message: `${order.orderRef} — ${label} is ready for your approval.`,
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
    description: `Requested client approval for ${order.orderRef} (${label})`,
    recordId: order.id,
    recordType: "BespokeOrder",
  });

  return { ok: true, approvalId: approval.id, approval };
}

type StaffContact = {
  email: string | null;
  name: string | null;
  role: string;
  userPermissions: { permission: string; mode: string }[];
};

/** Middleware bounces admin-access users out of /staff and staff-only users out of /admin. */
function orderPathForStaff(user: StaffContact, orderId: string): string {
  const hasAdmin = userHasAdminAccess({
    role: user.role,
    permissionGrants: user.userPermissions.filter((p) => p.mode === "GRANT").map((p) => p.permission),
    permissionRevokes: user.userPermissions.filter((p) => p.mode === "REVOKE").map((p) => p.permission),
  });
  return hasAdmin ? `/admin/bespoke/${orderId}` : `/staff/orders/${orderId}`;
}

async function applyStageApprovalDecision(params: {
  approval: {
    id: string;
    stage: BespokeStage;
    status: StageApprovalStatus;
    orderStage: { stage: BespokeStage; label: string | null };
    order: {
      id: string;
      orderRef: string;
      clientEmail: string;
      clientProfileId: string | null;
      currentStage: BespokeStage;
      assignments: {
        staffProfile: {
          userId: string;
          user: StaffContact;
        };
      }[];
    };
  };
  decision: "APPROVED" | "CHANGES_REQUESTED";
  comment?: string | null;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (params.approval.status !== StageApprovalStatus.PENDING) {
    return { ok: false, status: 409, error: "This approval has already been responded to." };
  }

  const comment = params.comment?.trim() || null;
  if (params.decision === "CHANGES_REQUESTED" && !comment) {
    return { ok: false, status: 400, error: "Please describe the changes you would like." };
  }

  await prisma.stageApproval.update({
    where: { id: params.approval.id },
    data: {
      status:
        params.decision === "APPROVED"
          ? StageApprovalStatus.APPROVED
          : StageApprovalStatus.CHANGES_REQUESTED,
      respondedAt: new Date(),
      clientComment: comment,
    },
  });

  const approval = params.approval;
  const stageLabel = stepLabel(approval.orderStage);

  if (params.decision === "CHANGES_REQUESTED") {
    const staffTargets = new Map<string, StaffContact>();
    for (const a of approval.order.assignments) {
      staffTargets.set(a.staffProfile.userId, a.staffProfile.user);
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
          orderUrl: `${getPublicAppUrl()}${orderPathForStaff(staff, approval.order.id)}`,
          approvalId: approval.id,
        }).catch((e) => {
          void logServerError({ errorType: "STAGE_CHANGES_EMAIL", error: e });
        });
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

const STAGE_APPROVAL_ORDER_SELECT = {
  id: true,
  orderRef: true,
  clientEmail: true,
  clientProfileId: true,
  currentStage: true,
  assignments: {
    where: { completedAt: null },
    include: {
      staffProfile: {
        select: {
          userId: true,
          user: {
            select: {
              email: true,
              name: true,
              role: true,
              userPermissions: { select: { permission: true, mode: true } },
            },
          },
        },
      },
    },
  },
} as const;

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
    include: { order: { select: STAGE_APPROVAL_ORDER_SELECT }, orderStage: { select: { stage: true, label: true } } },
  });
  if (!approval) return { ok: false, status: 404, error: "Approval not found." };

  // Her email counts only once she has proven it; the session email alone does not.
  const proven = await provenEmail(params.clientUserId);
  const emailMatch = proven !== null && approval.order.clientEmail.trim().toLowerCase() === proven;
  const profile = approval.order.clientProfileId
    ? await prisma.clientProfile.findUnique({
        where: { id: approval.order.clientProfileId },
        select: { userId: true },
      })
    : null;
  if (!emailMatch && profile?.userId !== params.clientUserId) {
    return { ok: false, status: 403, error: "Forbidden." };
  }

  return applyStageApprovalDecision({
    approval,
    decision: params.decision,
    comment: params.comment,
  });
}

export async function respondToStageApprovalByToken(params: {
  publicToken: string;
  decision: "APPROVED" | "CHANGES_REQUESTED";
  comment?: string | null;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const found = await findStageApprovalByPublicToken(params.publicToken);
  if (!found.ok) {
    if (found.reason === "expired") {
      return { ok: false, status: 410, error: CAPABILITY_EXPIRED_COPY.body };
    }
    return { ok: false, status: 404, error: "Approval not found." };
  }

  const approval = await prisma.stageApproval.findUnique({
    where: { id: found.approval.id },
    include: { order: { select: STAGE_APPROVAL_ORDER_SELECT }, orderStage: { select: { stage: true, label: true } } },
  });
  if (!approval) return { ok: false, status: 404, error: "Approval not found." };

  return applyStageApprovalDecision({
    approval,
    decision: params.decision,
    comment: params.comment,
  });
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
