import { prisma } from "@/lib/prisma";
import { appendMovement, newIssueRef, parseQty } from "@/lib/store/ledger";
import {
  MATERIAL_KINDS,
  MATERIAL_KIND_LABELS,
  type MaterialKind,
  type MaterialRow,
} from "@/lib/atelier/commission-materials-shared";

export * from "@/lib/atelier/commission-materials-shared";

/**
 * Slice BD3/BD4 — what a gown needs, and what that costs, on one row with two
 * gates. The row says what (beads, fabric, lining; how much; a pattern; a
 * picture). Its unit and total cost are written only by someone who may see
 * cost, and read back only by them (redactBespokeOrder / materialView).
 *
 * Taking an item out of the store writes the StoreMovement ISSUE the store book
 * already keeps — in the same transaction as the row, so the two cannot part.
 */

const MAX_IMAGES = 8;

export type MaterialInput = {
  kind: MaterialKind | null;
  name: string | null;
  quantity: string | null;
  notes: string | null;
  supplier: string | null;
  images: string[];
  unitCost: number | null;
  totalCost: number | null;
  storeItemId: string | null;
  takenById: string | null;
  approvedById: string | null;
};

const str = (v: unknown, max = 400) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const num = (v: unknown) => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/** Pure: a POST body → input. Cost fields are dropped unless `mayCost`. */
export function parseMaterialInput(
  raw: unknown,
  mayCost: boolean,
): { ok: true; input: MaterialInput } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Send the material." };
  const r = raw as Record<string, unknown>;
  const kind = typeof r.kind === "string" && (MATERIAL_KINDS as readonly string[]).includes(r.kind) ? (r.kind as MaterialKind) : null;
  const images = Array.isArray(r.images)
    ? r.images.filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u)).slice(0, MAX_IMAGES)
    : [];
  const input: MaterialInput = {
    kind,
    name: str(r.name, 200),
    quantity: str(r.quantity, 60),
    notes: str(r.notes, 1000),
    supplier: str(r.supplier, 200),
    images,
    unitCost: mayCost ? num(r.unitCost) : null,
    totalCost: mayCost ? num(r.totalCost) : null,
    storeItemId: str(r.storeItemId, 64),
    takenById: str(r.takenById, 64),
    approvedById: str(r.approvedById, 64),
  };
  if (!input.name && !input.storeItemId) return { ok: false, error: "Name the material, or pick it from the store." };
  return { ok: true, input };
}

export async function addCommissionMaterial(
  orderId: string,
  input: MaterialInput,
  actor: { id: string },
): Promise<{ ok: true; id: string } | { ok: false; status: 400 | 404 | 409; error: string }> {
  const order = await prisma.bespokeOrder.findUnique({ where: { id: orderId }, select: { status: true } });
  if (!order) return { ok: false, status: 404, error: "Not found" };
  if (order.status === "ARCHIVED") return { ok: false, status: 409, error: "Archived commissions cannot take materials." };

  const base = {
    orderId,
    kind: input.kind,
    notes: input.notes,
    images: input.images,
    addedById: actor.id,
  };

  if (!input.storeItemId) {
    const row = await prisma.material.create({
      data: {
        ...base,
        name: input.name!,
        quantity: input.quantity,
        supplier: input.supplier,
        unitCost: input.unitCost,
        totalCost: input.totalCost ?? input.unitCost,
      },
      select: { id: true },
    });
    return { ok: true, id: row.id };
  }

  const item = await prisma.storeItem.findUnique({ where: { id: input.storeItemId } });
  if (!item) return { ok: false, status: 404, error: "Store item not found." };
  const qty = parseQty(input.quantity);
  if (qty == null || qty <= 0) return { ok: false, status: 400, error: "Quantity is required to issue from the store." };
  const takenById = input.takenById || actor.id;
  if (!input.approvedById) {
    return { ok: false, status: 400, error: "An issue needs who is taking it and the supervisor who approved." };
  }

  const row = await prisma.$transaction(async (tx) => {
    const movement = await appendMovement(
      {
        itemId: item.id,
        delta: -qty,
        reason: "ISSUE",
        actorId: actor.id,
        takenById,
        approvedById: input.approvedById!,
        bespokeOrderId: orderId,
        ref: newIssueRef(),
        note: input.notes,
      },
      tx,
    );
    const unitCost = input.unitCost ?? (item.unitCost ? Number(item.unitCost) : null);
    return tx.material.create({
      data: {
        ...base,
        name: input.name || item.name,
        quantity: input.quantity ?? String(qty),
        supplier: input.supplier ?? item.supplier,
        unitCost,
        totalCost: input.totalCost ?? (unitCost != null ? Math.round(unitCost * qty * 100) / 100 : null),
        storeItemId: item.id,
        storeMovementId: movement.id,
      },
      select: { id: true },
    });
  });
  return { ok: true, id: row.id };
}

type MaterialSource = {
  id: string;
  kind: string | null;
  name: string;
  quantity: string | null;
  notes: string | null;
  images: string[];
  storeMovementId: string | null;
  unitCost: number | null;
  totalCost: number | null;
  createdAt: Date;
};

/** The specification as a viewer may read it: cost keys are absent, not zero, without the cost gate. */
export function materialView(m: MaterialSource, mayCost: boolean): MaterialRow {
  const kind = m.kind && (MATERIAL_KINDS as readonly string[]).includes(m.kind) ? (m.kind as MaterialKind) : null;
  return {
    id: m.id,
    kind,
    kindLabel: kind ? MATERIAL_KIND_LABELS[kind] : "Material",
    name: m.name,
    quantity: m.quantity,
    notes: m.notes,
    images: m.images,
    issued: Boolean(m.storeMovementId),
    createdAt: m.createdAt.toISOString(),
    ...(mayCost ? { unitCost: m.unitCost, totalCost: m.totalCost } : {}),
  };
}
