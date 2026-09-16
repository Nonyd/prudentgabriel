import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function fromStoreError(e: unknown) {
  if (e instanceof Error) {
    const locked = /already locked|Day one is locked/i.test(e.message);
    return jsonError(e.message, locked ? 409 : 400);
  }
  return jsonError("Store error", 500);
}

export function num(d: Prisma.Decimal | number | null | undefined): number | null {
  if (d == null) return null;
  return Number(d);
}

export const PEOPLE_SELECT = { id: true, name: true, email: true, role: true } as const;

export const MOVEMENT_INCLUDE = {
  item: { select: { id: true, name: true, unit: true } },
  actor: { select: { id: true, name: true, email: true } },
  takenBy: { select: { id: true, name: true, email: true } },
  approvedBy: { select: { id: true, name: true, email: true } },
  receivedBy: { select: { id: true, name: true, email: true } },
  bespokeOrder: { select: { id: true, orderRef: true, clientName: true } },
  order: { select: { id: true, orderNumber: true } },
  returns: { select: { id: true, delta: true } },
} as const;

export function personLabel(u: { name: string | null; email: string } | null | undefined): string | null {
  if (!u) return null;
  return u.name || u.email;
}

export function movementJson(m: {
  id: string;
  delta: Prisma.Decimal | number;
  reason: string;
  note: string | null;
  ref: string | null;
  createdAt: Date;
  item: { id: string; name: string; unit: string };
  actor: { name: string | null; email: string };
  takenBy: { name: string | null; email: string } | null;
  approvedBy: { name: string | null; email: string } | null;
  receivedBy: { name: string | null; email: string } | null;
  bespokeOrder: { id: string; orderRef: string; clientName: string } | null;
  order: { id: string; orderNumber: string } | null;
  returns?: { delta: Prisma.Decimal | number }[];
  takenById?: string | null;
  approvedById?: string | null;
  receivedById?: string | null;
  itemId?: string;
  issueId?: string | null;
  bespokeOrderId?: string | null;
  orderId?: string | null;
}) {
  const delta = Number(m.delta);
  const returned = (m.returns ?? []).reduce((s, r) => s + Number(r.delta), 0);
  return {
    id: m.id,
    itemId: m.item.id,
    itemName: m.item.name,
    unit: m.item.unit,
    delta,
    reason: m.reason,
    note: m.note,
    ref: m.ref,
    createdAt: m.createdAt,
    actorName: personLabel(m.actor),
    takenByName: personLabel(m.takenBy),
    approvedByName: personLabel(m.approvedBy),
    receivedByName: personLabel(m.receivedBy),
    client: m.bespokeOrder?.clientName ?? (m.order?.orderNumber ? `Order ${m.order.orderNumber}` : null),
    orderRef: m.bespokeOrder?.orderRef ?? m.order?.orderNumber ?? null,
    bespokeOrderId: m.bespokeOrder?.id ?? null,
    shopOrderId: m.order?.id ?? null,
    outstanding: m.reason === "ISSUE" ? -delta - returned : null,
  };
}
