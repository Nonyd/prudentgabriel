import { ActivityAction, PaymentMethod, PaymentStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CASCADE_CONFIRMATION } from "@/lib/cascade-copy";
import { ProductCascadeError, enableLedgerBypass, type CascadeActor } from "@/lib/product-cascade-delete";
import {
  COMMISSION_CASCADE_MODULE,
  COMMISSION_CASCADE_RECORD_TYPE,
  commissionDialogCopy,
  type CommissionCascadePreview,
  type CommissionCascadeSnapshot,
} from "@/lib/commission-cascade-copy";

/**
 * Delete a commission and what hangs off it (Slice AC's decision: delete, with
 * warnings, not a key that refuses).
 *
 * Goes with it:  notes (append-only — via the ledger bypass, inside the
 *   transaction), materials, end-of-day entries, cost sheets (items and labour
 *   lines), stage history, assignments, features, alteration requests, and —
 *   Super Admin and typed DELETE, as for consultations — its payments.
 * Refused, with the reason: store movements and requisitions. The store book
 *   records what physically left the shelf and what money was released; the
 *   trigger will not even detach a movement, and deleting one would change
 *   the shelf counts.
 */

function money(n: number) {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}

export async function previewCommissionCascade(orderId: string): Promise<CommissionCascadePreview> {
  const o = await prisma.bespokeOrder.findUnique({
    where: { id: orderId },
    select: {
      orderRef: true,
      clientName: true,
      _count: {
        select: {
          commissionNotes: true,
          materials: true,
          workLogs: true,
          costsOfProduction: true,
          stageHistory: true,
          storeMovements: true,
          requisitions: true,
        },
      },
      payments: {
        orderBy: { createdAt: "asc" },
        select: { reference: true, method: true, status: true, amount: true, confirmedAt: true, createdAt: true },
      },
    },
  });
  if (!o) throw new ProductCascadeError("NOT_FOUND", "Not found", 404);

  const c = o._count;
  const payments = o.payments.map((p) => ({
    reference: p.reference,
    method: p.method,
    status: p.status,
    amountNGN: Number(p.amount),
    at: (p.confirmedAt ?? p.createdAt).toISOString(),
    orderNumber: o.orderRef,
  }));
  const receivedNGN = money(
    o.payments
      .filter((p) => (p.status === PaymentStatus.CONFIRMED || p.status === PaymentStatus.PAID) && p.method !== PaymentMethod.POINTS)
      .reduce((s, p) => s + Number(p.amount), 0),
  );
  const counts = {
    notes: c.commissionNotes,
    materials: c.materials,
    workLogs: c.workLogs,
    costSheets: c.costsOfProduction,
    stageRecords: c.stageHistory,
    payments: payments.length,
  };
  const blockers = [
    c.storeMovements ? `${c.storeMovements} store ${c.storeMovements === 1 ? "movement" : "movements"}` : null,
    c.requisitions ? `${c.requisitions} ${c.requisitions === 1 ? "requisition" : "requisitions"}` : null,
  ].filter(Boolean);
  return {
    orderRef: o.orderRef,
    clientName: o.clientName,
    counts,
    payments,
    receivedNGN,
    loud: Object.values(counts).some((n) => n > 0),
    superAdminOnly: payments.length > 0,
    blocked: blockers.length > 0,
    blockReason: blockers.length ? `${o.orderRef} has ${blockers.join(" and ")} in the store book.` : null,
  };
}

export async function executeCommissionCascade(opts: {
  orderId: string;
  actor: CascadeActor;
  confirmation?: string;
}): Promise<{ logId: string; preview: CommissionCascadePreview }> {
  const preview = await previewCommissionCascade(opts.orderId);
  if (preview.blocked) throw new ProductCascadeError("BLOCKED", preview.blockReason ?? "Cannot delete", 409);
  if (preview.superAdminOnly && opts.actor.role !== "SUPER_ADMIN") {
    throw new ProductCascadeError("FORBIDDEN", "Only a Super Admin can delete a commission that has payments", 403);
  }
  if (preview.loud && opts.confirmation !== CASCADE_CONFIRMATION) {
    throw new ProductCascadeError("CONFIRM", `Type ${CASCADE_CONFIRMATION} to delete ${preview.orderRef} and what goes with it`, 400);
  }

  const id = opts.orderId;
  try {
    const logId = await prisma.$transaction(
      async (tx) => {
        await enableLedgerBypass(tx);
        await tx.commissionNote.deleteMany({ where: { orderId: id } });
        await tx.costOfProduction.deleteMany({ where: { bespokeOrderId: id } });
        await tx.payment.deleteMany({ where: { bespokeOrderId: id } });
        // Cascade from here: stage history, assignments (and their work logs), materials, features, alterations.
        await tx.bespokeOrder.delete({ where: { id } });
        return writeLog(tx, preview, opts.actor, id);
      },
      { timeout: 60_000, maxWait: 15_000 },
    );
    return { logId, preview };
  } catch (e) {
    if (e instanceof ProductCascadeError) throw e;
    throw new ProductCascadeError("FAILED", "Delete failed; nothing was removed", 500);
  }
}

async function writeLog(
  tx: Prisma.TransactionClient,
  p: CommissionCascadePreview,
  actor: CascadeActor,
  orderId: string,
): Promise<string> {
  // Counts and payment references — never the words of a note.
  const snapshot: CommissionCascadeSnapshot = {
    kind: COMMISSION_CASCADE_RECORD_TYPE,
    orderRef: p.orderRef,
    clientName: p.clientName,
    counts: p.counts,
    payments: p.payments,
    receivedNGN: p.receivedNGN,
    actor: { userId: actor.userId, email: actor.email, role: actor.role, ip: actor.ip },
  };
  const row = await tx.activityLog.create({
    data: {
      userId: actor.userId,
      userEmail: actor.email,
      userRole: actor.role,
      action: ActivityAction.DELETE,
      module: COMMISSION_CASCADE_MODULE,
      description: `Deleted commission ${p.orderRef}. ${commissionDialogCopy(p).lines.filter((l) => l.startsWith("·")).join(" ")}`.trim(),
      recordId: orderId,
      recordType: COMMISSION_CASCADE_RECORD_TYPE,
      ipAddress: actor.ip,
      snapshot: snapshot as Prisma.InputJsonValue,
    },
  });
  return row.id;
}
