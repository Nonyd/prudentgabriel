/**
 * Slice AQ phase 1: the store book.
 *
 *   pnpm test:slice-aq
 */
import "./preload-test-env";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import {
  appendMovement,
  issueOutstanding,
  lockDayOne,
  onHand,
  parseQty,
  STORE_BOOK_ID,
} from "../src/lib/store/ledger";
import { matrixAccess, roleMayAccessAdminPath, firstAdminPathForRole } from "../src/lib/admin-route-access";
import { roleAllows } from "../src/lib/roles";
import { INVITE_ROLES, INVITE_ROLE_LABELS } from "../src/lib/admin-users";
import { EDITABLE_ADMIN_ROLES } from "../src/lib/permission-catalog";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const srcRoot = join(root, "src");
const stamp = `aq-${Date.now()}`;

const ids = {
  userIds: [] as string[],
  categoryIds: [] as string[],
  itemIds: [] as string[],
  movementIds: [] as string[],
  materialIds: [] as string[],
  orderIds: [] as string[],
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

function src(rel: string) {
  return readFileSync(join(srcRoot, rel), "utf8");
}

async function cleanup() {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT set_config('app.ledger_bypass', 'on', true)`);
    if (ids.materialIds.length) {
      await tx.material.deleteMany({ where: { id: { in: ids.materialIds } } });
    }
    if (ids.itemIds.length) {
      await tx.storeMovement.deleteMany({ where: { itemId: { in: ids.itemIds }, reason: "RETURN" } });
      await tx.storeMovement.deleteMany({ where: { itemId: { in: ids.itemIds } } });
      await tx.storeItem.deleteMany({ where: { id: { in: ids.itemIds } } });
    } else if (ids.movementIds.length) {
      await tx.storeMovement.deleteMany({ where: { id: { in: ids.movementIds }, reason: "RETURN" } });
      await tx.storeMovement.deleteMany({ where: { id: { in: ids.movementIds } } });
    }
    if (ids.categoryIds.length) {
      await tx.itemCategory.deleteMany({ where: { id: { in: ids.categoryIds } } });
    }
    if (ids.orderIds.length) {
      await tx.bespokeOrder.deleteMany({ where: { id: { in: ids.orderIds } } });
    }
    if (ids.userIds.length) {
      await tx.user.deleteMany({ where: { id: { in: ids.userIds } } });
    }
  });
}

async function main() {
  assert(roleAllows("STORE_MANAGER", "store"), "Store Manager reaches the store");
  assert(!roleAllows("STORE_MANAGER", "shop.orders"), "Store Manager does not reach shop orders");
  assert(!roleAllows("STORE_MANAGER", "clients"), "Store Manager does not reach clients");
  assert(!roleAllows("STORE_MANAGER", "bespoke"), "Store Manager does not reach the atelier pipeline");
  assert(matrixAccess("STORE_MANAGER", "/admin/store") === "allow", "Store Manager opens the morning view");
  assert(matrixAccess("STORE_MANAGER", "/admin/orders") === "deny", "store-only actor is denied /admin/orders");
  assert(matrixAccess("STORE_MANAGER", "/admin/clients") === "deny", "store-only actor is denied /admin/clients");
  assert(!roleMayAccessAdminPath("STORE_MANAGER", "/admin/orders"), "STORE_MANAGER 403 on /admin/orders");
  assert(!roleMayAccessAdminPath("STORE_MANAGER", "/admin/clients"), "STORE_MANAGER 403 on /admin/clients");
  assert(firstAdminPathForRole("STORE_MANAGER") === "/admin/store", "Store Manager lands on the morning view");

  const ordersApi = src("app/api/admin/orders/route.ts");
  assert(ordersApi.includes('requireAdminApi("shop.orders")'), "/api/admin/orders is shop.orders — store-only 403");
  const clientsApi = src("app/api/admin/customers/route.ts");
  assert(clientsApi.includes('requireAdminApi("clients")'), "/api/admin/customers is clients — store-only 403");

  assert(INVITE_ROLES.includes(Role.STORE_MANAGER), "Store Manager is granted through the Users & Roles editor");
  assert(INVITE_ROLE_LABELS.STORE_MANAGER === "Store Manager", "Store Manager label");
  assert(
    (EDITABLE_ADMIN_ROLES as readonly string[]).includes("STORE_MANAGER"),
    "Store Manager permissions are editable in Slice T",
  );

  const seed = readFileSync(join(root, "prisma/seed.ts"), "utf8");
  assert(!seed.includes("STORE_MANAGER"), "seed does not grant the storekeeper by editing the seed");

  const migration = readFileSync(
    join(root, "prisma/migrations/20260916_slice_aq_store_book/migration.sql"),
    "utf8",
  );
  assert(migration.includes("store_movement_append_only"), "append-only trigger ships in the migration");
  assert(migration.includes("ON DELETE RESTRICT"), "movements restrict on delete");
  assert(!/INSERT INTO "User"/.test(migration), "migration does not seed a storekeeper person");

  const form = src("components/admin/BespokeOrderDetailClient.tsx");
  assert(form.includes("quantity"), "atelier material form collects quantity");
  assert(form.includes("unitCost"), "atelier material form collects cost");
  assert(form.includes("isArchived"), "atelier material form is hidden on archived commissions");
  assert(form.includes("Issue from store") || form.includes("storeItemId"), "add material can issue from the store");

  const patch = src("app/api/bespoke/[orderId]/route.ts");
  assert(patch.includes("appendMovement"), "atelier add-material writes an ISSUE");
  assert(patch.includes("ARCHIVED"), "archived commissions cannot take materials");

  assert(parseQty("3.5 yards") === 3.5, "half a yard parses");
  assert(parseQty("½") == null, "non-numeric quantity is rejected");
  assert(issueOutstanding(-4, [1, 0.5]) === 2.5, "outstanding is issued minus returns");

  const storefrontHits: string[] = [];
  for (const file of walkFiles(join(srcRoot, "app"))) {
    const rel = file.slice(srcRoot.length + 1).replace(/\\/g, "/");
    if (rel.startsWith("app/(admin)/")) continue;
    if (rel.startsWith("app/api/admin/")) continue;
    if (rel.startsWith("app/api/bespoke/")) continue;
    const text = readFileSync(file, "utf8");
    if (
      /\bStoreItem\b/.test(text) ||
      /\bStoreMovement\b/.test(text) ||
      /@\/lib\/store["'/]/.test(text)
    ) {
      storefrontHits.push(rel);
    }
  }
  assert(storefrontHits.length === 0, `no customer-path file may touch the store: ${storefrontHits.join(", ")}`);

  const srcHits: string[] = [];
  for (const file of walkFiles(srcRoot)) {
    const rel = file.slice(srcRoot.length + 1).replace(/\\/g, "/");
    if (rel.startsWith("lib/store/")) continue;
    const text = readFileSync(file, "utf8");
    if (text.includes("storeMovement.update") || text.includes("storeMovement.delete")) {
      srcHits.push(rel);
    }
  }
  assert(srcHits.length === 0, `application code must not update or delete movements: ${srcHits.join(", ")}`);

  const actor = await prisma.user.create({
    data: { email: `${stamp}-actor@example.test`, name: "AQ Actor", role: Role.STORE_MANAGER },
  });
  const taker = await prisma.user.create({
    data: { email: `${stamp}-taker@example.test`, name: "AQ Taker", role: Role.STAFF },
  });
  const supervisor = await prisma.user.create({
    data: { email: `${stamp}-sup@example.test`, name: "AQ Supervisor", role: Role.STAFF },
  });
  const receiver = await prisma.user.create({
    data: { email: `${stamp}-recv@example.test`, name: "AQ Receiver", role: Role.STORE_MANAGER },
  });
  ids.userIds.push(actor.id, taker.id, supervisor.id, receiver.id);

  const category = await prisma.itemCategory.create({
    data: { name: `AQ Fabric ${stamp}`, sortOrder: 999 },
  });
  ids.categoryIds.push(category.id);

  const item = await prisma.storeItem.create({
    data: {
      name: `AQ Swiss lace ${stamp}`,
      categoryId: category.id,
      unit: "yard",
      storeLine: "SHARED",
    },
  });
  ids.itemIds.push(item.id);

  const receipt = await appendMovement({
    itemId: item.id,
    delta: 10,
    reason: "RECEIPT",
    actorId: actor.id,
    note: "Arrival counted",
  });
  ids.movementIds.push(receipt.id);

  const issue = await appendMovement({
    itemId: item.id,
    delta: -3.5,
    reason: "ISSUE",
    actorId: actor.id,
    takenById: taker.id,
    approvedById: supervisor.id,
    note: "Ready to cut",
    ref: `ISS-AQ-${stamp}`,
  });
  ids.movementIds.push(issue.id);
  assert(issue.approvedById === supervisor.id, "an issue records its approver");

  let issueWithoutApprover = false;
  try {
    await appendMovement({
      itemId: item.id,
      delta: -1,
      reason: "ISSUE",
      actorId: actor.id,
      takenById: taker.id,
    });
  } catch {
    issueWithoutApprover = true;
  }
  assert(issueWithoutApprover, "an issue without a supervisor is refused");

  const ret = await appendMovement({
    itemId: item.id,
    delta: 1,
    reason: "RETURN",
    actorId: actor.id,
    issueId: issue.id,
    receivedById: receiver.id,
  });
  ids.movementIds.push(ret.id);
  assert(ret.issueId === issue.id, "a return closes against its issue");

  let overReturn = false;
  try {
    await appendMovement({
      itemId: item.id,
      delta: 10,
      reason: "RETURN",
      actorId: actor.id,
      issueId: issue.id,
      receivedById: receiver.id,
    });
  } catch {
    overReturn = true;
  }
  assert(overReturn, "a return cannot exceed what is still out");

  const correction = await appendMovement({
    itemId: item.id,
    delta: 0.5,
    reason: "ADJUSTMENT",
    actorId: actor.id,
    note: "Found on the table after the count",
  });
  ids.movementIds.push(correction.id);

  const qty = await onHand(item.id);
  const summed = await prisma.storeMovement.aggregate({
    where: { itemId: item.id },
    _sum: { delta: true },
  });
  assert(qty === Number(summed._sum.delta ?? 0), "on-hand equals the movement sum");
  assert(qty === 8, `on-hand 10 - 3.5 + 1 + 0.5 = 8, got ${qty}`);

  const rows = await prisma.storeMovement.findMany({
    where: { itemId: item.id },
    orderBy: { createdAt: "asc" },
  });
  assert(rows.length === 4, "a correction is a new row");
  assert(Number(rows[0].delta) === 10, "the original receipt delta is unchanged");

  let mutated = false;
  try {
    await prisma.storeMovement.update({
      where: { id: receipt.id },
      data: { delta: new Prisma.Decimal(99) },
    });
    mutated = true;
  } catch {
    mutated = false;
  }
  assert(!mutated, "the database refuses an UPDATE of delta");

  const bookSnap = await prisma.storeBook.findUnique({ where: { id: STORE_BOOK_ID } });
  try {
    if (bookSnap?.dayOne) {
      let blocked = false;
      try {
        await appendMovement({
          itemId: item.id,
          delta: 1,
          reason: "OPENING",
          actorId: actor.id,
        });
      } catch {
        blocked = true;
      }
      assert(blocked, "OPENING is refused after day one is locked");
    } else {
      await prisma.storeBook.update({
        where: { id: STORE_BOOK_ID },
        data: { dayOne: new Date(), lockedById: actor.id, lockedAt: new Date() },
      });
      let blocked = false;
      try {
        await appendMovement({
          itemId: item.id,
          delta: 1,
          reason: "OPENING",
          actorId: actor.id,
        });
      } catch {
        blocked = true;
      }
      assert(blocked, "OPENING is refused after day one is locked");
    }
  } finally {
    await prisma.storeBook.update({
      where: { id: STORE_BOOK_ID },
      data: {
        dayOne: bookSnap?.dayOne ?? null,
        lockedById: bookSnap?.lockedById ?? null,
        lockedAt: bookSnap?.lockedAt ?? null,
      },
    });
  }

  let doubleLock = false;
  const again = await prisma.storeBook.findUnique({ where: { id: STORE_BOOK_ID } });
  if (again?.dayOne) {
    try {
      await lockDayOne(actor.id);
    } catch {
      doubleLock = true;
    }
    assert(doubleLock, "day one cannot be locked twice");
  }

  console.log("slice-aq: ok");
}

main()
  .catch(async (e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup().catch((e) => {
      console.error("slice-aq cleanup failed", e);
      process.exitCode = 1;
    });
    await prisma.$disconnect();
  });
