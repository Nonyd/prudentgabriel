import {
  formatReceivedNGN,
  joinNamedList,
  type CascadeActorSnap,
  type CascadeDialogCopy,
  type CascadePaymentSnap,
} from "@/lib/cascade-copy";

/**
 * Deleting a commission, in Slice AC's shape: everything that goes with it is
 * counted in the warning first, the typed DELETE is asked whenever anything
 * goes with it, and the activity log keeps the counts — never a note's words.
 */
export const COMMISSION_CASCADE_RECORD_TYPE = "commission-cascade-delete";
export const COMMISSION_CASCADE_MODULE = "bespoke";

export type CommissionCascadeCounts = {
  notes: number;
  materials: number;
  workLogs: number;
  costSheets: number;
  stageRecords: number;
  payments: number;
};

export type CommissionCascadePreview = {
  orderRef: string;
  clientName: string;
  counts: CommissionCascadeCounts;
  payments: CascadePaymentSnap[];
  receivedNGN: number;
  /** Something goes with it: the typed confirmation is asked. */
  loud: boolean;
  /** Payments go with it: Super Admin only, as for consultations. */
  superAdminOnly: boolean;
  blocked: boolean;
  blockReason: string | null;
};

export type CommissionCascadeSnapshot = {
  kind: typeof COMMISSION_CASCADE_RECORD_TYPE;
  orderRef: string;
  clientName: string;
  counts: CommissionCascadeCounts;
  payments: CascadePaymentSnap[];
  receivedNGN: number;
  actor: CascadeActorSnap;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function commissionDialogCopy(p: CommissionCascadePreview): CascadeDialogCopy {
  const heading = `${p.orderRef} (${p.clientName}) will be deleted.`;
  if (p.blocked) {
    return {
      title: `Cannot delete ${p.orderRef}`,
      heading: p.blockReason ?? "This commission cannot be deleted.",
      lines: ["The store book keeps what physically left the shelf. Close the commission instead."],
      loud: false,
      blocked: true,
    };
  }
  if (!p.loud) {
    return {
      title: `Delete ${p.orderRef}`,
      heading,
      lines: ["Nothing else is attached.", "The client record is kept.", "This cannot be undone."],
      loud: false,
    };
  }
  const c = p.counts;
  const lines = ["Deleting this also removes:"];
  if (c.notes) lines.push(`· ${plural(c.notes, "note", "notes")} on the file`);
  if (c.materials) lines.push(`· ${plural(c.materials, "material line", "material lines")} (beads, fabric)`);
  if (c.workLogs) lines.push(`· ${plural(c.workLogs, "end-of-day entry", "end-of-day entries")}`);
  if (c.costSheets) lines.push(`· ${plural(c.costSheets, "cost sheet", "cost sheets")}`);
  if (c.payments) {
    lines.push(`· ${plural(c.payments, "payment", "payments")} — ${formatReceivedNGN(p.receivedNGN)} received`);
  }
  if (c.stageRecords) lines.push(`· its stage history (${plural(c.stageRecords, "entry", "entries")})`);
  lines.push("The client record is kept.");
  lines.push("This cannot be undone.");
  return {
    title: p.superAdminOnly ? `Delete a paid commission — ${p.orderRef}` : `Delete ${p.orderRef}`,
    heading,
    lines: p.payments.length ? lines.concat(`Payments: ${joinNamedList(p.payments.map((x) => x.reference))}`) : lines,
    loud: true,
  };
}
