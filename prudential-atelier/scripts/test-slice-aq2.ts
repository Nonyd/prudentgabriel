/**
 * Slice AQ phases 2–3: requisition chain, cost of production, ProductMaterial.
 *
 *   pnpm test:slice-aq2
 */
import "./preload-test-env";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { onHand } from "../src/lib/store/ledger";
import { morningView } from "../src/lib/store/ledger";
import {
  RequisitionError,
  advanceRequisition,
  declineRequisition,
} from "../src/lib/requisition/chain";
import {
  canAdvanceRequisition,
  canFundRequisition,
  nextRequisitionStatus,
  newRequisitionRef,
} from "../src/lib/requisition/states";
import { roleAllows } from "../src/lib/roles";
import { matrixAccess, firstAdminPathForRole } from "../src/lib/admin-route-access";
import { INVITE_ROLES } from "../src/lib/admin-users";
import { EDITABLE_ADMIN_ROLES } from "../src/lib/permission-catalog";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const srcRoot = join(root, "src");
const stamp = `aq2-${Date.now()}`;

const ids = {
  userIds: [] as string[],
  categoryIds: [] as string[],
  itemIds: [] as string[],
  orderIds: [] as string[],
  productIds: [] as string[],
  costIds: [] as string[],
  requisitionIds: [] as string[],
  materialIds: [] as string[],
};

function walkFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walkFiles(full));
    else if (/\.(ts|tsx|js|jsx)$/.test(name)) out.push(full);
  }
  return out;
}

async function cleanup() {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT set_config('app.ledger_bypass', 'on', true)`);
    if (ids.requisitionIds.length) {
      await tx.requisitionEvent.deleteMany({ where: { requisitionId: { in: ids.requisitionIds } } });
      await tx.requisitionLine.deleteMany({ where: { requisitionId: { in: ids.requisitionIds } } });
      await tx.requisition.deleteMany({ where: { id: { in: ids.requisitionIds } } });
    }
    if (ids.costIds.length) {
      await tx.costOfProductionItem.deleteMany({ where: { costOfProductionId: { in: ids.costIds } } });
      await tx.costOfProduction.deleteMany({ where: { id: { in: ids.costIds } } });
    }
    if (ids.materialIds.length) {
      await tx.productMaterial.deleteMany({ where: { id: { in: ids.materialIds } } });
    }
    if (ids.itemIds.length) {
      await tx.storeMovement.deleteMany({ where: { itemId: { in: ids.itemIds } } });
      await tx.storeItem.deleteMany({ where: { id: { in: ids.itemIds } } });
    }
    if (ids.categoryIds.length) {
      await tx.itemCategory.deleteMany({ where: { id: { in: ids.categoryIds } } });
    }
    if (ids.orderIds.length) {
      await tx.orderItem.deleteMany({ where: { orderId: { in: ids.orderIds } } });
      await tx.order.deleteMany({ where: { id: { in: ids.orderIds } } });
    }
    if (ids.productIds.length) {
      await tx.product.deleteMany({ where: { id: { in: ids.productIds } } });
    }
    if (ids.userIds.length) {
      await tx.user.deleteMany({ where: { id: { in: ids.userIds } } });
    }
  });
}

async function main() {
  // —— Authz mapping (AQ6 confirmed) ——
  assert(canFundRequisition("ADMIN"), "ADMIN can fund");
  assert(!canFundRequisition("SUPER_ADMIN"), "SUPER_ADMIN cannot fund");
  assert(!canFundRequisition("FINANCE_MANAGER"), "FINANCE_MANAGER cannot fund");
  assert(!canFundRequisition("STAFF_ADMIN"), "STAFF_ADMIN cannot fund");
  assert(roleAllows("BESPOKE_MANAGER", "production.cost"), "BESPOKE_MANAGER drafts CoP");
  assert(roleAllows("BESPOKE_MANAGER", "requisition.approve"), "BESPOKE_MANAGER stock-checks");
  assert(roleAllows("FINANCE_MANAGER", "payments"), "accounts reuses payments");
  assert(roleAllows("PROCUREMENT_OFFICER", "requisition.buy"), "procurement buys");
  assert(!roleAllows("PROCUREMENT_OFFICER", "store"), "procurement is not the storekeeper");
  assert(INVITE_ROLES.includes(Role.PROCUREMENT_OFFICER), "PROCUREMENT_OFFICER is inviteable");
  assert(
    (EDITABLE_ADMIN_ROLES as readonly string[]).includes("PROCUREMENT_OFFICER"),
    "Slice T can edit PROCUREMENT_OFFICER",
  );
  assert(matrixAccess("PROCUREMENT_OFFICER", "/admin/store/requisitions") === "allow", "buyer reaches requisitions");
  assert(firstAdminPathForRole("PROCUREMENT_OFFICER") === "/admin/store/requisitions", "buyer lands on requisitions");

  // Cannot skip a state
  assert(!canAdvanceRequisition("RAISED", "FUNDED"), "cannot skip RAISED → FUNDED");
  assert(canAdvanceRequisition("RAISED", "STOCK_CHECKED"), "RAISED → STOCK_CHECKED ok");
  assert(nextRequisitionStatus("CLOSED") === null, "CLOSED has no forward");

  // Storefront isolation
  const customerRoots = [
    "app/(shop)",
    "app/(storefront)",
    "components/shop",
    "components/checkout",
    "components/cart",
    "components/product",
  ].map((r) => join(srcRoot, r));
  const banned = /\b(CostOfProduction|Requisition|ProductMaterial|requisition\.(fund|buy|approve)|production\.cost)\b/;
  const hits: string[] = [];
  for (const rootDir of customerRoots) {
    for (const file of walkFiles(rootDir)) {
      const text = readFileSync(file, "utf8");
      if (banned.test(text)) hits.push(file.slice(srcRoot.length + 1));
    }
  }
  assert(hits.length === 0, `phase 2/3 must not appear in the customer path: ${hits.join(", ")}`);

  const actor = await prisma.user.create({
    data: {
      email: `${stamp}-admin@example.test`,
      name: "AQ2 Admin",
      role: "ADMIN",
    },
  });
  ids.userIds.push(actor.id);

  const finance = await prisma.user.create({
    data: {
      email: `${stamp}-finance@example.test`,
      name: "AQ2 Finance",
      role: "FINANCE_MANAGER",
    },
  });
  ids.userIds.push(finance.id);

  const superA = await prisma.user.create({
    data: {
      email: `${stamp}-super@example.test`,
      name: "AQ2 Super",
      role: "SUPER_ADMIN",
    },
  });
  ids.userIds.push(superA.id);

  const buyer = await prisma.user.create({
    data: {
      email: `${stamp}-buy@example.test`,
      name: "AQ2 Buyer",
      role: "PROCUREMENT_OFFICER",
    },
  });
  ids.userIds.push(buyer.id);

  const cat = await prisma.itemCategory.create({
    data: { name: `AQ2 Fabric ${stamp}`, sortOrder: 99 },
  });
  ids.categoryIds.push(cat.id);

  const item = await prisma.storeItem.create({
    data: {
      name: `AQ2 Lace ${stamp}`,
      categoryId: cat.id,
      unit: "yard",
      storeLine: "SHARED",
    },
  });
  ids.itemIds.push(item.id);

  const product = await prisma.product.create({
    data: {
      name: `AQ2 Piece ${stamp}`,
      slug: `aq2-piece-${stamp}`,
      description: "test",
      category: "FORMAL",
      priceNGN: 10000,
      basePriceNGN: 10000,
      isPublished: false,
    },
  });
  ids.productIds.push(product.id);

  // Product with no material list still "sells" (no throw, morning has no bom_short for it alone)
  const emptyMorning = await morningView();
  assert(
    !emptyMorning.needs.some((n) => n.label.includes(product.name) && n.kind === "bom_short"),
    "product with no list does not create a morning shortfall",
  );

  const mat = await prisma.productMaterial.create({
    data: {
      productId: product.id,
      itemId: item.id,
      quantityPerUnit: new Prisma.Decimal(4),
      unit: "yard",
    },
  });
  ids.materialIds.push(mat.id);

  const order = await prisma.order.create({
    data: {
      orderNumber: `AQ2-${stamp}`,
      guestEmail: `${stamp}-client@example.test`,
      status: "CONFIRMED",
      paymentStatus: "PAID",
      subtotal: 10000,
      total: 10000,
      currency: "NGN",
      items: {
        create: {
          productId: product.id,
          quantity: 2,
          price: 10000,
          lineTotal: 20000,
        },
      },
    },
  });
  ids.orderIds.push(order.id);

  const morning = await morningView();
  const bomNeed = morning.needs.find((n) => n.kind === "bom_short" && n.itemId === item.id);
  assert(bomNeed, "morning view reflects ProductMaterial shortfall once lists exist");
  assert(morning.needsSource?.includes("material list"), "panel labels what it compares");

  const cost = await prisma.costOfProduction.create({
    data: {
      orderId: order.id,
      tailorCostNGN: new Prisma.Decimal(15000),
      draftedById: actor.id,
      status: "APPROVED",
      approvedById: actor.id,
      approvedAt: new Date(),
      items: {
        create: [
          {
            itemId: item.id,
            quantity: new Prisma.Decimal(8),
            unit: "yard",
            estimatedCostNGN: new Prisma.Decimal(40000),
          },
        ],
      },
    },
  });
  ids.costIds.push(cost.id);

  const req = await prisma.requisition.create({
    data: {
      ref: newRequisitionRef(),
      costOfProductionId: cost.id,
      orderId: order.id,
      raisedById: actor.id,
      lines: {
        create: [
          {
            itemId: item.id,
            quantity: new Prisma.Decimal(8),
            unit: "yard",
            estimatedCostNGN: new Prisma.Decimal(40000),
          },
        ],
      },
      events: {
        create: {
          fromStatus: null,
          toStatus: "RAISED",
          actorId: actor.id,
          note: "Raised",
        },
      },
    },
  });
  ids.requisitionIds.push(req.id);

  // Same-person consecutive (AQ12): allow + flag
  await advanceRequisition({
    requisitionId: req.id,
    actor: { id: actor.id, role: "ADMIN", name: actor.name },
  });
  const afterStock = await prisma.requisition.findUnique({ where: { id: req.id } });
  assert(afterStock?.status === "STOCK_CHECKED", "advanced to STOCK_CHECKED");
  assert(afterStock?.sameActorShortCircuit === true, "AQ12 flags same-person consecutive steps");
  const sameEvt = await prisma.requisitionEvent.findFirst({
    where: { requisitionId: req.id, toStatus: "STOCK_CHECKED" },
  });
  assert(sameEvt?.sameActorAsPrevious === true, "event records sameActorAsPrevious");

  // Skip attempt
  let skipped = false;
  try {
    await prisma.requisition.update({ where: { id: req.id }, data: { status: "FUNDED" } });
    // force status back and try advance from STOCK_CHECKED with wrong target via API semantics
  } catch {
    skipped = true;
  }
  // Restore and verify chain refuses jump by only exposing next
  await prisma.requisition.update({ where: { id: req.id }, data: { status: "STOCK_CHECKED" } });
  assert(nextRequisitionStatus("STOCK_CHECKED") === "WITH_ACCOUNTS", "must go via accounts");
  assert(!canAdvanceRequisition("STOCK_CHECKED", "FUNDED"), "cannot skip to FUNDED");
  void skipped;

  // Finance can move to awaiting funds; cannot fund
  await advanceRequisition({
    requisitionId: req.id,
    actor: { id: finance.id, role: "FINANCE_MANAGER", name: finance.name },
  });
  await advanceRequisition({
    requisitionId: req.id,
    actor: { id: finance.id, role: "FINANCE_MANAGER", name: finance.name },
  });
  const awaiting = await prisma.requisition.findUnique({ where: { id: req.id } });
  assert(awaiting?.status === "AWAITING_FUNDS", "with accounts → awaiting funds");

  let financeFunded = false;
  try {
    await advanceRequisition({
      requisitionId: req.id,
      actor: { id: finance.id, role: "FINANCE_MANAGER", name: finance.name },
    });
    financeFunded = true;
  } catch (e) {
    assert(e instanceof RequisitionError && e.status === 403, "finance fund refused 403");
  }
  assert(!financeFunded, "FINANCE_MANAGER cannot release funds");

  let superFunded = false;
  try {
    await advanceRequisition({
      requisitionId: req.id,
      actor: { id: superA.id, role: "SUPER_ADMIN", name: superA.name },
    });
    superFunded = true;
  } catch (e) {
    assert(e instanceof RequisitionError && e.status === 403, "SUPER_ADMIN fund refused 403");
  }
  assert(!superFunded, "SUPER_ADMIN-without-ADMIN cannot release funds");

  await advanceRequisition({
    requisitionId: req.id,
    actor: { id: actor.id, role: "ADMIN", name: actor.name },
  });
  assert((await prisma.requisition.findUnique({ where: { id: req.id } }))?.status === "FUNDED", "ADMIN funded");

  await advanceRequisition({
    requisitionId: req.id,
    actor: { id: buyer.id, role: "PROCUREMENT_OFFICER", name: buyer.name },
  });
  assert((await prisma.requisition.findUnique({ where: { id: req.id } }))?.status === "PURCHASED", "buyer recorded purchase");

  // Partial receipt — only confirmed qty hits the shelf
  const before = await onHand(item.id);
  const lines = await prisma.requisitionLine.findMany({ where: { requisitionId: req.id } });
  await advanceRequisition({
    requisitionId: req.id,
    actor: { id: actor.id, role: "ADMIN", name: actor.name },
    lines: lines.map((l) => ({ id: l.id, confirmedQuantity: 5 })),
  });
  const afterRecv = await prisma.requisition.findUnique({
    where: { id: req.id },
    include: { lines: true },
  });
  assert(afterRecv?.status === "RECEIVED", "status RECEIVED");
  assert(Number(afterRecv?.lines[0].confirmedQuantity) === 5, "confirmed 5");
  assert(Number(afterRecv?.lines[0].shortfallQuantity) === 3, "shortfall 3 visible");
  const afterHand = await onHand(item.id);
  assert(afterHand === before + 5, `RECEIPT writes only confirmed qty (5), got delta ${afterHand - before}`);

  // Decline path on a fresh requisition → fabric-unavailable
  const req2 = await prisma.requisition.create({
    data: {
      ref: newRequisitionRef(),
      orderId: order.id,
      raisedById: actor.id,
      lines: {
        create: [
          {
            freeText: "Unavailable silk",
            quantity: new Prisma.Decimal(2),
            unit: "yard",
            estimatedCostNGN: new Prisma.Decimal(10000),
          },
        ],
      },
      events: {
        create: { fromStatus: null, toStatus: "RAISED", actorId: actor.id },
      },
    },
  });
  ids.requisitionIds.push(req2.id);

  await declineRequisition({
    requisitionId: req2.id,
    actor: { id: actor.id, role: "ADMIN", name: actor.name },
    reason: "Silk not available this week",
  });
  const declined = await prisma.requisition.findUnique({ where: { id: req2.id } });
  assert(declined?.status === "DECLINED", "declined");
  assert(declined?.declineReason === "Silk not available this week", "decline reason recorded");
  const orderAfter = await prisma.order.findUnique({ where: { id: order.id } });
  assert(orderAfter?.fabricUnavailableAt, "decline enters fabric-unavailable queue");
  assert(orderAfter?.fabricUnavailableNote?.includes("Silk"), "reason on the order");

  console.log("OK test:slice-aq2");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup().catch(() => {});
    await prisma.$disconnect();
  });
