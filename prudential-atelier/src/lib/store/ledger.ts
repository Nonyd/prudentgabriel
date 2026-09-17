import { Prisma, StoreMovementReason } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseQty, toQty } from "@/lib/store/qty";

export { SUGGESTED_UNITS, formatQty, parseQty, toQty } from "@/lib/store/qty";

export const STORE_BOOK_ID = "house";

export const ISSUE_DELTA_REASONS: StoreMovementReason[] = ["ISSUE", "WRITE_OFF"];

export async function onHand(itemId: string, db: Prisma.TransactionClient | typeof prisma = prisma): Promise<number> {
  const agg = await db.storeMovement.aggregate({
    where: { itemId },
    _sum: { delta: true },
  });
  return toQty(agg._sum.delta ?? 0);
}

export async function onHandByItemIds(
  itemIds: string[],
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (itemIds.length === 0) return out;
  const grouped = await db.storeMovement.groupBy({
    by: ["itemId"],
    where: { itemId: { in: itemIds } },
    _sum: { delta: true },
  });
  for (const id of itemIds) out.set(id, 0);
  for (const row of grouped) out.set(row.itemId, toQty(row._sum.delta ?? 0));
  return out;
}

export type AppendMovementInput = {
  itemId: string;
  delta: number;
  reason: StoreMovementReason;
  actorId: string;
  note?: string | null;
  ref?: string | null;
  takenById?: string | null;
  approvedById?: string | null;
  receivedById?: string | null;
  bespokeOrderId?: string | null;
  orderId?: string | null;
  issueId?: string | null;
};

export async function appendMovement(
  input: AppendMovementInput,
  db: Prisma.TransactionClient | typeof prisma = prisma,
) {
  if (!Number.isFinite(input.delta) || input.delta === 0) {
    throw new Error("Quantity must be a non-zero number.");
  }
  if (input.reason === "ISSUE" && input.delta > 0) {
    throw new Error("An issue leaves the store — quantity must be taken, not added.");
  }
  if (input.reason === "ISSUE" && (!input.takenById || !input.approvedById)) {
    throw new Error("An issue needs who is taking it and the supervisor who approved.");
  }
  if (input.reason === "RETURN" && (!input.issueId || !input.receivedById)) {
    throw new Error("A return closes against an issue and records the receiver.");
  }
  if ((input.reason === "RECEIPT" || input.reason === "OPENING" || input.reason === "RETURN") && input.delta < 0) {
    throw new Error(`${input.reason} adds to the shelf — quantity must be positive.`);
  }
  if (input.reason === "WRITE_OFF" && input.delta > 0) {
    throw new Error("A write-off leaves the store — quantity must be taken, not added.");
  }

  if (input.reason === "OPENING") {
    const book = await db.storeBook.findUnique({ where: { id: STORE_BOOK_ID } });
    if (book?.dayOne) {
      throw new Error("Day one is locked. Record a later find as an ADJUSTMENT with a note.");
    }
  }

  if (input.reason === "RETURN" && input.issueId) {
    const issue = await db.storeMovement.findUnique({
      where: { id: input.issueId },
      include: { returns: { select: { delta: true } } },
    });
    if (!issue || issue.reason !== "ISSUE") {
      throw new Error("Return must close against an issue.");
    }
    if (issue.itemId !== input.itemId) {
      throw new Error("Return must be the same item as the issue.");
    }
    const outstanding = -toQty(issue.delta) - issue.returns.reduce((s, r) => s + toQty(r.delta), 0);
    if (input.delta - outstanding > 1e-9) {
      throw new Error(`Only ${outstanding} remains on that issue.`);
    }
  }

  return db.storeMovement.create({
    data: {
      itemId: input.itemId,
      delta: new Prisma.Decimal(input.delta),
      reason: input.reason,
      actorId: input.actorId,
      note: input.note?.trim() || null,
      ref: input.ref?.trim() || null,
      takenById: input.takenById || null,
      approvedById: input.approvedById || null,
      receivedById: input.receivedById || null,
      bespokeOrderId: input.bespokeOrderId || null,
      orderId: input.orderId || null,
      issueId: input.issueId || null,
    },
  });
}

export function newIssueRef(at = new Date()): string {
  const y = at.getUTCFullYear();
  const m = String(at.getUTCMonth() + 1).padStart(2, "0");
  const d = String(at.getUTCDate()).padStart(2, "0");
  const n = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ISS-${y}${m}${d}-${n}`;
}

export async function lockDayOne(actorId: string, dayOne = new Date()) {
  const existing = await prisma.storeBook.findUnique({ where: { id: STORE_BOOK_ID } });
  if (existing?.dayOne) {
    throw new Error("Day one is already locked.");
  }
  return prisma.storeBook.upsert({
    where: { id: STORE_BOOK_ID },
    create: { id: STORE_BOOK_ID, dayOne, lockedById: actorId, lockedAt: new Date() },
    update: { dayOne, lockedById: actorId, lockedAt: new Date() },
  });
}

export async function getStoreBook() {
  return (
    (await prisma.storeBook.findUnique({ where: { id: STORE_BOOK_ID } })) ??
    (await prisma.storeBook.create({ data: { id: STORE_BOOK_ID } }))
  );
}

const userName = { select: { id: true, name: true, email: true } } as const;

export async function morningView(now = new Date()) {
  const startYesterday = new Date(now);
  startYesterday.setHours(0, 0, 0, 0);
  startYesterday.setDate(startYesterday.getDate() - 1);
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);

  const [book, categories, yesterday, openMaterials] = await Promise.all([
    getStoreBook(),
    prisma.itemCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        items: {
          where: { isActive: true },
          orderBy: { name: "asc" },
          include: { movements: { select: { delta: true } } },
        },
      },
    }),
    prisma.storeMovement.findMany({
      where: { createdAt: { gte: startYesterday, lt: startToday } },
      orderBy: { createdAt: "asc" },
      include: {
        item: { select: { name: true, unit: true } },
        actor: userName,
        takenBy: userName,
        approvedBy: userName,
        receivedBy: userName,
        bespokeOrder: { select: { orderRef: true, clientName: true } },
        order: { select: { orderNumber: true } },
      },
    }),
    prisma.material.findMany({
      where: {
        storeItemId: { not: null },
        order: { status: { not: "ARCHIVED" }, deliveredAt: null },
      },
      include: {
        storeItem: { select: { id: true, name: true, unit: true } },
        order: { select: { id: true, orderRef: true, clientName: true } },
      },
    }),
  ]);

  const onHandRows = categories.flatMap((c) =>
    c.items.map((item) => {
      const qty = item.movements.reduce((s, m) => s + toQty(m.delta), 0);
      return {
        id: item.id,
        name: item.name,
        unit: item.unit,
        categoryId: c.id,
        categoryName: c.name,
        onHand: qty,
        storeLine: item.storeLine,
        unitCost: item.unitCost ? toQty(item.unitCost) : null,
      };
    }),
  );

  const onHandMap = new Map(onHandRows.map((r) => [r.id, r.onHand]));
  const needs: {
    kind: "short" | "overissued" | "unlisted" | "bom_short";
    label: string;
    detail: string;
    itemId?: string;
  }[] = [];

  for (const row of onHandRows) {
    if (row.onHand < -1e-9) {
      needs.push({
        kind: "overissued",
        itemId: row.id,
        label: row.name,
        detail: `On hand ${row.onHand} ${row.unit} — issued beyond what the shelf holds.`,
      });
    }
  }

  for (const mat of openMaterials) {
    const wanted = parseQty(mat.quantity);
    if (wanted == null || !mat.storeItemId || !mat.storeItem) continue;
    const have = onHandMap.get(mat.storeItemId) ?? 0;
    if (wanted - have > 1e-9) {
      needs.push({
        kind: "short",
        itemId: mat.storeItemId,
        label: `${mat.order.clientName} · ${mat.order.orderRef}`,
        detail: `Needs ${wanted} ${mat.storeItem.unit} of ${mat.storeItem.name}; store holds ${have}.`,
      });
    }
  }

  const unlisted = await prisma.material.findMany({
    where: {
      storeItemId: null,
      order: { status: { not: "ARCHIVED" }, deliveredAt: null },
    },
    include: { order: { select: { orderRef: true, clientName: true } } },
    take: 40,
  });
  for (const mat of unlisted) {
    needs.push({
      kind: "unlisted",
      label: `${mat.order.clientName} · ${mat.order.orderRef}`,
      detail: `${mat.name}${mat.quantity ? ` · ${mat.quantity}` : ""} is on the gown and not in the store catalogue.`,
    });
  }

  // AQ11: open paid shop orders × ProductMaterial lists vs shelf.
  const openShop = await prisma.orderItem.findMany({
    where: {
      order: {
        paymentStatus: "PAID",
        status: { notIn: ["CANCELLED", "REFUNDED", "DELIVERED", "COLLECTED", "ARCHIVED"] },
      },
    },
    select: {
      quantity: true,
      productId: true,
      optionId: true,
      order: { select: { orderNumber: true } },
      product: { select: { name: true } },
    },
    take: 500,
  });
  const productIds = Array.from(new Set(openShop.map((r) => r.productId).filter(Boolean))) as string[];
  const bom =
    productIds.length === 0
      ? []
      : await prisma.productMaterial.findMany({
          where: { productId: { in: productIds }, isOptional: false },
          include: { item: { select: { id: true, name: true, unit: true } } },
        });
  const demandByItem = new Map<string, { need: number; unit: string; name: string; samples: string[] }>();
  for (const line of openShop) {
    if (!line.productId) continue;
    const mats = bom.filter(
      (m) =>
        m.productId === line.productId &&
        (m.productOptionId == null || m.productOptionId === line.optionId),
    );
    for (const m of mats) {
      const add = toQty(m.quantityPerUnit) * line.quantity;
      const cur = demandByItem.get(m.itemId) ?? {
        need: 0,
        unit: m.unit || m.item.unit,
        name: m.item.name,
        samples: [],
      };
      cur.need += add;
      const tag = `${line.product.name} · ${line.order.orderNumber}`;
      if (cur.samples.length < 3 && !cur.samples.includes(tag)) cur.samples.push(tag);
      demandByItem.set(m.itemId, cur);
    }
  }
  for (const [itemId, d] of Array.from(demandByItem.entries())) {
    const have = onHandMap.get(itemId) ?? 0;
    if (d.need - have > 1e-9) {
      needs.push({
        kind: "bom_short",
        itemId,
        label: d.name,
        detail: `Open paid orders need ${d.need} ${d.unit}; store holds ${have}. ${d.samples.join("; ")}`,
      });
    }
  }

  return {
    book: {
      dayOne: book.dayOne,
      lockedAt: book.lockedAt,
    },
    /** AQ11: empty is not a full shelf — this panel only sees typed commissions + product lists. */
    needsSource:
      "Comparing typed commission materials and product material lists against the shelf. A piece with no list does not appear here.",
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      sortOrder: c.sortOrder,
      items: onHandRows.filter((r) => r.categoryId === c.id),
    })),
    yesterday: yesterday.map((m) => ({
      id: m.id,
      delta: toQty(m.delta),
      reason: m.reason,
      createdAt: m.createdAt,
      note: m.note,
      ref: m.ref,
      itemName: m.item.name,
      unit: m.item.unit,
      actorName: m.actor.name || m.actor.email,
      takenByName: m.takenBy ? m.takenBy.name || m.takenBy.email : null,
      approvedByName: m.approvedBy ? m.approvedBy.name || m.approvedBy.email : null,
      receivedByName: m.receivedBy ? m.receivedBy.name || m.receivedBy.email : null,
      client:
        m.bespokeOrder?.clientName ??
        (m.order?.orderNumber ? `Order ${m.order.orderNumber}` : null),
      orderRef: m.bespokeOrder?.orderRef ?? m.order?.orderNumber ?? null,
    })),
    needs,
  };
}

export function issueOutstanding(issueDelta: Prisma.Decimal | number, returnDeltas: Array<Prisma.Decimal | number>): number {
  const issued = toQty(issueDelta);
  const returned = returnDeltas.reduce((sum: number, d) => sum + toQty(d), 0);
  return -issued - returned;
}
