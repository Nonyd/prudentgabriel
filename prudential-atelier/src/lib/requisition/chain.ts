import { Prisma, RequisitionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { appendMovement } from "@/lib/store/ledger";
import { onHand } from "@/lib/store/ledger";
import { toQty } from "@/lib/store/qty";
import {
  TERMINAL_REQUISITION,
  canAdvanceRequisition,
  canFundRequisition,
  nextRequisitionStatus,
  permissionForTransition,
  STATUS_LABEL,
} from "@/lib/requisition/states";
import type { AdminPermission } from "@/lib/roles";
import { roleAllows } from "@/lib/roles";

export class RequisitionError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

type Actor = { id: string; role: string; name?: string | null; email?: string | null };

function actorLabel(a: Actor): string {
  return a.name?.trim() || a.email || a.id;
}

async function assertTransitionPerm(actor: Actor, to: RequisitionStatus) {
  const need = permissionForTransition(to);
  if (!need) throw new RequisitionError("Unknown transition.");
  if (need === "fund_admin") {
    if (!canFundRequisition(actor.role)) {
      throw new RequisitionError(
        "Only General Admin (Mrs. Prudent) can release funds. Super Admin and finance cannot.",
        403,
      );
    }
    return;
  }
  if (!roleAllows(actor.role, need as AdminPermission)) {
    throw new RequisitionError(`You need ${need} for this step.`, 403);
  }
}

async function lastEventActorId(requisitionId: string): Promise<string | null> {
  const last = await prisma.requisitionEvent.findFirst({
    where: { requisitionId },
    orderBy: { createdAt: "desc" },
    select: { actorId: true },
  });
  return last?.actorId ?? null;
}

async function notifyDesk(req: {
  id: string;
  ref: string;
  status: RequisitionStatus;
}, targets: string[]) {
  void createNotification({
    type: "REQUISITION_PENDING",
    title: `Requisition ${req.ref} — ${STATUS_LABEL[req.status]}`,
    message: `Waiting for the next desk.`,
    link: `/admin/store/requisitions/${req.id}`,
    entityId: req.id,
    targetPermissions: targets,
  }).catch(() => {});
}

function targetsAfter(to: RequisitionStatus): string[] {
  switch (to) {
    case "STOCK_CHECKED":
      return ["payments"];
    case "WITH_ACCOUNTS":
      return ["payments"];
    case "AWAITING_FUNDS":
      return ["requisition.fund"];
    case "FUNDED":
      return ["requisition.buy"];
    case "PURCHASED":
      return ["requisition.approve"];
    case "RECEIVED":
      return ["store"];
    case "CLOSED":
      return ["store"];
    case "DECLINED":
      return ["shop.orders", "bespoke", "store"];
    default:
      return ["store"];
  }
}

/** Enter Slice AG's 48h fabric-unavailable queue when a requisition cannot be met. */
export async function enterFabricUnavailableQueue(params: {
  orderId: string | null;
  actor: Actor;
  reason: string;
  requisitionRef: string;
}) {
  if (!params.orderId) return;
  const order = await prisma.order.findUnique({ where: { id: params.orderId } });
  if (!order) return;
  if (order.fabricUnavailableAt) return;
  const stamp = new Date().toISOString().slice(0, 10);
  const line = `\n[${stamp}] Fabric unavailable via requisition ${params.requisitionRef}: ${params.reason}`;
  await prisma.order.update({
    where: { id: order.id },
    data: {
      fabricUnavailableAt: new Date(),
      fabricUnavailableById: params.actor.id,
      fabricUnavailableByName: actorLabel(params.actor),
      fabricUnavailableNote: params.reason,
      adminNotes: [order.adminNotes?.trim() ?? "", line].filter(Boolean).join("\n"),
    },
  });
  const { notifyFabricUnavailable } = await import("@/lib/notifications");
  notifyFabricUnavailable({ id: order.id, orderNumber: order.orderNumber });
}

export async function advanceRequisition(params: {
  requisitionId: string;
  actor: Actor;
  note?: string | null;
  /** Line updates for stock check / purchase / receive. */
  lines?: {
    id: string;
    coveredByStock?: boolean;
    confirmedQuantity?: number | null;
    shortfallQuantity?: number | null;
  }[];
}) {
  const req = await prisma.requisition.findUnique({
    where: { id: params.requisitionId },
    include: { lines: true, events: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!req) throw new RequisitionError("Not found.", 404);
  if (TERMINAL_REQUISITION.includes(req.status)) {
    throw new RequisitionError("This requisition is closed.");
  }

  const to = nextRequisitionStatus(req.status);
  if (!to) throw new RequisitionError("No further step.");
  if (!canAdvanceRequisition(req.status, to)) {
    throw new RequisitionError("Cannot skip a state.");
  }

  await assertTransitionPerm(params.actor, to);

  const prevActor = req.events[0]?.actorId ?? (await lastEventActorId(req.id));
  const sameActor = Boolean(prevActor && prevActor === params.actor.id);

  return prisma.$transaction(async (tx) => {
    if (to === "STOCK_CHECKED" && params.lines?.length) {
      for (const line of params.lines) {
        await tx.requisitionLine.update({
          where: { id: line.id },
          data: { coveredByStock: Boolean(line.coveredByStock) },
        });
      }
    }

    if (to === "PURCHASED" && params.lines?.length) {
      for (const line of params.lines) {
        if (line.shortfallQuantity != null) {
          await tx.requisitionLine.update({
            where: { id: line.id },
            data: {
              shortfallQuantity: new Prisma.Decimal(line.shortfallQuantity),
            },
          });
        }
      }
    }

    // AQ9: RECEIVED writes RECEIPT against confirmed quantities only — never requested.
    if (to === "RECEIVED") {
      if (params.lines?.length) {
        for (const line of params.lines) {
          const row = req.lines.find((l) => l.id === line.id);
          if (!row) continue;
          const confirmed =
            line.confirmedQuantity != null ? line.confirmedQuantity : toQty(row.quantity);
          const requested = toQty(row.quantity);
          const shortfall = Math.max(0, requested - confirmed);
          await tx.requisitionLine.update({
            where: { id: line.id },
            data: {
              confirmedQuantity: new Prisma.Decimal(confirmed),
              shortfallQuantity: shortfall > 1e-9 ? new Prisma.Decimal(shortfall) : null,
            },
          });
        }
      }
      const fresh = await tx.requisitionLine.findMany({ where: { requisitionId: req.id } });
      for (const line of fresh) {
        if (line.coveredByStock || !line.itemId) continue;
        const qty = line.confirmedQuantity != null ? toQty(line.confirmedQuantity) : 0;
        if (qty <= 0) continue;
        await appendMovement(
          {
            itemId: line.itemId,
            delta: qty,
            reason: "RECEIPT",
            actorId: params.actor.id,
            note: `Requisition ${req.ref} received`,
            ref: req.ref,
            orderId: req.orderId,
            bespokeOrderId: req.bespokeOrderId,
          },
          tx,
        );
      }
    }

    const updated = await tx.requisition.update({
      where: { id: req.id },
      data: {
        status: to,
        sameActorShortCircuit: req.sameActorShortCircuit || sameActor,
      },
    });

    await tx.requisitionEvent.create({
      data: {
        requisitionId: req.id,
        fromStatus: req.status,
        toStatus: to,
        actorId: params.actor.id,
        note: params.note?.trim() || null,
        sameActorAsPrevious: sameActor,
      },
    });

    return updated;
  }).then(async (updated) => {
    await notifyDesk(updated, targetsAfter(to));
    return updated;
  });
}

export async function declineRequisition(params: {
  requisitionId: string;
  actor: Actor;
  reason: string;
}) {
  const reason = params.reason.trim();
  if (!reason) throw new RequisitionError("A decline needs a reason.");

  const req = await prisma.requisition.findUnique({ where: { id: params.requisitionId } });
  if (!req) throw new RequisitionError("Not found.", 404);
  if (TERMINAL_REQUISITION.includes(req.status)) {
    throw new RequisitionError("This requisition is already closed.");
  }

  const prevActor = await lastEventActorId(req.id);
  const sameActor = Boolean(prevActor && prevActor === params.actor.id);

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.requisition.update({
      where: { id: req.id },
      data: {
        status: "DECLINED",
        declineReason: reason,
        sameActorShortCircuit: req.sameActorShortCircuit || sameActor,
      },
    });
    await tx.requisitionEvent.create({
      data: {
        requisitionId: req.id,
        fromStatus: req.status,
        toStatus: "DECLINED",
        actorId: params.actor.id,
        note: reason,
        sameActorAsPrevious: sameActor,
      },
    });
    return row;
  });

  await enterFabricUnavailableQueue({
    orderId: req.orderId,
    actor: params.actor,
    reason,
    requisitionRef: req.ref,
  });
  await notifyDesk(updated, targetsAfter("DECLINED"));
  return updated;
}

/** Suggest which raised lines the shelf already covers (stock check helper). */
export async function suggestStockCoverage(requisitionId: string) {
  const lines = await prisma.requisitionLine.findMany({
    where: { requisitionId },
    include: { item: { select: { name: true, unit: true } } },
  });
  const out: { id: string; onHand: number; covers: boolean; label: string }[] = [];
  for (const line of lines) {
    if (!line.itemId) {
      out.push({ id: line.id, onHand: 0, covers: false, label: line.freeText || "Free text" });
      continue;
    }
    const have = await onHand(line.itemId);
    const need = toQty(line.quantity);
    out.push({
      id: line.id,
      onHand: have,
      covers: have + 1e-9 >= need,
      label: line.item?.name || line.itemId,
    });
  }
  return out;
}
