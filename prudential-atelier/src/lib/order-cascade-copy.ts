import {
  formatReceivedNGN,
  joinNamedList,
  type CascadeActorSnap,
  type CascadeDialogCopy,
  type CascadePaymentSnap,
} from "@/lib/cascade-copy";

export const ORDER_CASCADE_RECORD_TYPE = "order-cascade-delete";
export const ORDER_CASCADE_MODULE = "orders";

export type OrderCascadeOrderSnap = {
  id: string;
  orderNumber: string;
  customer: string | null;
  totalNGN: number;
  paymentStatus: string;
  status: string;
  createdAt: string;
};

export type OrderCascadePreview = {
  /** Payment rows exist: Super Admin + typed DELETE. */
  loud: boolean;
  /** Atelier records (store issues, costs, requisitions) point at the order. */
  blocked: boolean;
  blockReason: string | null;
  /** Whether the viewer may run this delete (set by the preview route). */
  viewerCanDelete: boolean;
  order: OrderCascadeOrderSnap;
  payments: CascadePaymentSnap[];
  receivedNGN: number;
  /** Payments that are pending, failed or rejected (no money landed). */
  unconfirmedCount: number;
};

export type OrderCascadeSnapshot = {
  kind: typeof ORDER_CASCADE_RECORD_TYPE;
  order: OrderCascadeOrderSnap;
  payments: CascadePaymentSnap[];
  receivedNGN: number;
  actor: CascadeActorSnap;
};

export function orderDialogCopy(preview: OrderCascadePreview): CascadeDialogCopy {
  const number = preview.order.orderNumber;
  const heading = `Order ${number} will be deleted.`;
  if (preview.blocked) {
    return {
      title: "Cannot delete this order",
      heading: preview.blockReason ?? "Atelier records point at this order.",
      lines: [
        "Remove those records first, or cancel the order instead. Deleting from here would orphan them.",
      ],
      loud: false,
      blocked: true,
    };
  }
  if (!preview.loud) {
    return {
      title: `Delete ${number}`,
      heading,
      lines: ["No payment records. Line items go with it.", "The customer record is kept.", "This cannot be undone."],
      loud: false,
    };
  }

  const n = preview.payments.length;
  const paymentLine =
    preview.receivedNGN > 0
      ? `· ${n} ${n === 1 ? "payment" : "payments"} — ${formatReceivedNGN(preview.receivedNGN)} received`
      : `· ${n} ${n === 1 ? "payment" : "payments"}, none approved — no money received`;
  const refs = joinNamedList(preview.payments.map((p) => `${p.reference} (${p.status.toLowerCase()})`), 4);

  if (!preview.viewerCanDelete) {
    return {
      title: "Cannot delete this order",
      heading: `Order ${number} has payment records.`,
      lines: [
        paymentLine,
        `Payments: ${refs}.`,
        "Only a Super Admin can delete an order with payment records. Cancel it instead, or ask a Super Admin.",
      ],
      loud: false,
      blocked: true,
    };
  }

  return {
    title: preview.receivedNGN > 0 ? "Delete a paid order" : "Delete an order with payment records",
    heading,
    lines: [
      "Deleting this also removes:",
      paymentLine,
      `Payments: ${refs}.`,
      preview.receivedNGN > 0
        ? "Money was received on this order. The payment history is kept only in the activity log."
        : "The payment rows are kept in the activity log.",
      "The customer record is kept.",
      "This cannot be undone.",
    ],
    loud: true,
  };
}
