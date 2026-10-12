import { prisma } from "@/lib/prisma";
import type { BespokeView } from "@/lib/atelier/bespoke-access-rules";

/**
 * Slice BD4 — what a job costs, against what it was sold for.
 *
 * Cost of production = labour on the cost sheet + the materials taken for the
 * gown. Labour lives on CostOfProduction (one line per person, each pointing at
 * the assignment it pays); there is no second place for it. Materials are the
 * commission's own rows, issued from the store book.
 *
 * Who gets which part is decided by the view (bespoke-access-rules):
 *   materialCost — the store's side: materials and the sheet's material estimate
 *   labourCost   — labour, and the whole cost of production
 *   money        — the price agreed; with labourCost, the margin
 */

export type LabourLine = {
  id: string;
  role: string;
  person: string | null;
  description: string | null;
  amountNGN: number;
  assignmentId: string | null;
};

export type CommissionCost = {
  materials: {
    rows: { id: string; name: string; kind: string | null; quantity: string | null; totalCostNGN: number | null }[];
    totalNGN: number;
    /** Rows with no cost recorded: the total is a floor until they are priced. */
    unpriced: number;
  };
  sheet: {
    id: string;
    status: "DRAFT" | "APPROVED";
    materialEstimateNGN: number;
    labour?: LabourLine[];
    labourNGN?: number;
  } | null;
  costOfProductionNGN?: number;
  agreedPriceNGN?: number;
  marginNGN?: number;
};

const n = (v: unknown) => (v == null ? 0 : Number(v));

/** The sheet that counts: the latest approved, else the latest draft. */
function pickSheet<T extends { status: string; createdAt: Date }>(sheets: T[]): T | null {
  const sorted = [...sheets].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return sorted.find((s) => s.status === "APPROVED") ?? sorted[0] ?? null;
}

/** Labour on a sheet: its lines when it has them, else the single tailor figure from before BD. */
export function sheetLabourNGN(sheet: { tailorCostNGN: unknown; labour: { amountNGN: unknown }[] }): number {
  return sheet.labour.length ? sheet.labour.reduce((s, l) => s + n(l.amountNGN), 0) : n(sheet.tailorCostNGN);
}

export async function commissionCost(
  orderId: string,
  view: Pick<BespokeView, "money" | "materialCost" | "labourCost">,
): Promise<CommissionCost | null> {
  if (!view.materialCost && !view.labourCost) return null;
  const order = await prisma.bespokeOrder.findUnique({
    where: { id: orderId },
    select: {
      totalAmount: true,
      materials: {
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, kind: true, quantity: true, totalCost: true },
      },
      costsOfProduction: {
        select: {
          id: true,
          status: true,
          createdAt: true,
          tailorCostNGN: true,
          items: { select: { estimatedCostNGN: true } },
          labour: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              role: true,
              description: true,
              amountNGN: true,
              assignmentId: true,
              assignment: { select: { staffProfile: { select: { user: { select: { name: true, email: true } } } } } },
            },
          },
        },
      },
    },
  });
  if (!order) return null;

  const materialsTotal = order.materials.reduce((s, m) => s + n(m.totalCost), 0);
  const sheet = pickSheet(order.costsOfProduction);
  const labourNGN = sheet ? sheetLabourNGN(sheet) : 0;

  const out: CommissionCost = {
    materials: {
      rows: order.materials.map((m) => ({
        id: m.id,
        name: m.name,
        kind: m.kind,
        quantity: m.quantity,
        totalCostNGN: m.totalCost,
      })),
      totalNGN: materialsTotal,
      unpriced: order.materials.filter((m) => m.totalCost == null).length,
    },
    sheet: sheet
      ? {
          id: sheet.id,
          status: sheet.status,
          materialEstimateNGN: sheet.items.reduce((s, i) => s + n(i.estimatedCostNGN), 0),
          ...(view.labourCost
            ? {
                labourNGN,
                labour: sheet.labour.map((l) => ({
                  id: l.id,
                  role: l.role,
                  person: l.assignment?.staffProfile.user.name ?? l.assignment?.staffProfile.user.email ?? null,
                  description: l.description,
                  amountNGN: n(l.amountNGN),
                  assignmentId: l.assignmentId,
                })),
              }
            : {}),
        }
      : null,
  };
  if (view.labourCost) {
    out.costOfProductionNGN = labourNGN + materialsTotal;
    if (view.money) {
      out.agreedPriceNGN = order.totalAmount;
      out.marginNGN = order.totalAmount - out.costOfProductionNGN;
    }
  }
  return out;
}
