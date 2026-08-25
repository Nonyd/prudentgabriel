/**
 * Payment bind, fulfilment race, encryption fail-closed, seed admin.
 *
 *   pnpm test:payment-bind
 */
import "./preload-test-env";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { PaymentGateway, PaymentStatus, Role } from "@prisma/client";
import {
  assertPspChargeBinds,
  expectedAmountInPspUnits,
  PaymentBindError,
} from "../src/lib/payment-bind";
import { fulfillPaidOrder } from "../src/lib/order-payment";
import { seedBootstrapAdmin } from "../prisma/bootstrap-admin";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

function expectThrow(code: string, fn: () => void) {
  try {
    fn();
  } catch (e) {
    assert(e instanceof PaymentBindError, `expected PaymentBindError, got ${e}`);
    assert(e.code === code, `expected ${code}, got ${e.code}`);
    return;
  }
  throw new Error(`FAIL: expected ${code} to throw`);
}

const noLog = { log: false } as const;

function bind(target: Parameters<typeof assertPspChargeBinds>[0], charge: Parameters<typeof assertPspChargeBinds>[1]) {
  assertPspChargeBinds(target, charge, noLog);
}

function sampleOrder(id: string, storedReference: string | null, total = 50_000) {
  return {
    id,
    storedReference,
    expectedAmount: expectedAmountInPspUnits(PaymentGateway.PAYSTACK, total),
    expectedCurrency: "NGN",
  };
}

function makeFulfillDb(order: {
  id: string;
  total: number;
  items: { variantId: string | null; quantity: number }[];
}) {
  let status: PaymentStatus = PaymentStatus.PENDING;
  let stockDecrements = 0;
  let ledgerWrites = 0;
  const gate: { wait: Promise<void>; release: () => void } = (() => {
    let release = () => {};
    const wait = new Promise<void>((r) => {
      release = r;
    });
    return { wait, release };
  })();

  const row = {
    ...order,
    paymentStatus: status,
    userId: "user_1",
    guestEmail: null as string | null,
    guestName: null as string | null,
    guestPhone: null as string | null,
    orderNumber: "PA-26-00001",
    currency: "NGN",
    subtotal: order.total,
    shippingAmount: 0,
    discount: 0,
    pointsDiscountNGN: 0,
    addressSnapshot: null,
    user: { id: "user_1", email: "a@example.test", name: "A" },
    items: order.items.map((i) => ({ ...i, product: { name: "Dress" }, size: "M", color: "Black", price: order.total })),
  };

  const tx = {
    order: {
      updateMany: async (args: { where: { paymentStatus: PaymentStatus } }) => {
        await gate.wait;
        if (status !== PaymentStatus.PENDING || args.where.paymentStatus !== PaymentStatus.PENDING) {
          return { count: 0 };
        }
        status = PaymentStatus.PAID;
        return { count: 1 };
      },
    },
    productVariant: {
      updateMany: async () => {
        stockDecrements += 1;
        return { count: 1 };
      },
    },
    payment: {
      create: async () => {
        ledgerWrites += 1;
      },
    },
  };

  const db = {
    stockDecrements: () => stockDecrements,
    ledgerWrites: () => ledgerWrites,
    order: {
      findUnique: async () => ({ ...row, paymentStatus: status }),
    },
    $transaction: async (fn: (inner: typeof tx) => Promise<boolean>) => fn(tx),
  };

  return { db, release: gate.release, stock: () => stockDecrements, ledger: () => ledgerWrites };
}

async function main() {
  // Paying order A cannot mark order B paid (GET verify path: metadata + stored ref).
  expectThrow("REFERENCE_MISMATCH", () =>
    bind(sampleOrder("order-B", "PA-B"), {
      gateway: PaymentGateway.PAYSTACK,
      reference: "PA-A",
      amount: 5_000_000,
      currency: "NGN",
      metadataEntityId: "order-A",
    }),
  );

  // Same bind used by webhook handlers.
  expectThrow("REFERENCE_MISMATCH", () =>
    bind(sampleOrder("order-B", null), {
      gateway: PaymentGateway.PAYSTACK,
      reference: "PA-A",
      amount: 5_000_000,
      currency: "NGN",
      metadataEntityId: "order-A",
    }),
  );

  bind(sampleOrder("order-A", "PA-A"), {
    gateway: PaymentGateway.PAYSTACK,
    reference: "PA-A",
    amount: 5_000_000,
    currency: "NGN",
    metadataEntityId: "order-A",
  });

  bind(sampleOrder("order-A", "PA-A"), {
    gateway: PaymentGateway.PAYSTACK,
    reference: "PA-A",
    amount: 5_000_000,
    currency: "NGN",
    metadataEntityId: null,
  });

  // Amount lower than order.total is rejected (Paystack kobo).
  expectThrow("AMOUNT_MISMATCH", () =>
    bind(sampleOrder("order-A", "PA-A", 50_000), {
      gateway: PaymentGateway.PAYSTACK,
      reference: "PA-A",
      amount: 1_000,
      currency: "NGN",
      metadataEntityId: "order-A",
    }),
  );

  expectThrow("AMOUNT_MISMATCH", () =>
    bind(
      {
        id: "order-A",
        storedReference: "tx-A",
        expectedAmount: expectedAmountInPspUnits(PaymentGateway.FLUTTERWAVE, 50_000),
        expectedCurrency: "NGN",
      },
      {
        gateway: PaymentGateway.FLUTTERWAVE,
        reference: "tx-A",
        amount: 100,
        currency: "NGN",
        metadataEntityId: "order-A",
      },
    ),
  );

  expectThrow("AMOUNT_MISMATCH", () =>
    bind(
      {
        id: "order-A",
        storedReference: "pi_A",
        expectedAmount: expectedAmountInPspUnits(PaymentGateway.STRIPE, 120),
        expectedCurrency: "USD",
      },
      {
        gateway: PaymentGateway.STRIPE,
        reference: "pi_A",
        amount: 50,
        currency: "USD",
        metadataEntityId: "order-A",
      },
    ),
  );

  // Currency mismatch.
  expectThrow("CURRENCY_MISMATCH", () =>
    bind(sampleOrder("order-A", "PA-A"), {
      gateway: PaymentGateway.PAYSTACK,
      reference: "PA-A",
      amount: 5_000_000,
      currency: "USD",
      metadataEntityId: "order-A",
    }),
  );

  // Concurrent fulfillPaidOrder: one claim, one stock decrement, one ledger write.
  const fixture = makeFulfillDb({
    id: "order-race",
    total: 50_000,
    items: [{ variantId: "var_1", quantity: 2 }],
  });
  const run = () =>
    fulfillPaidOrder({
      orderId: "order-race",
      paymentRef: "PA-race",
      gateway: PaymentGateway.PAYSTACK,
      db: fixture.db as never,
      clientId: "user_1",
      notify: false,
    });
  const pending = Promise.all([run(), run()]);
  fixture.release();
  const results = await pending;
  assert(results.filter(Boolean).length === 2, "both callers should report success (winner + already fulfilled)");
  assert(fixture.stock() === 1, `stock decrements expected 1, got ${fixture.stock()}`);
  assert(fixture.ledger() === 1, `ledger writes expected 1, got ${fixture.ledger()}`);

  // encrypt() throws when the key env is unset (module load).
  const env = { ...process.env };
  delete env.ENCRYPTION_KEY;
  delete env.SETTINGS_ENCRYPTION_KEY;
  const child = spawnSync(
    "pnpm",
    ["exec", "tsx", "--tsconfig", "tsconfig.scripts.json", "scripts/assert-encryption-throws.ts"],
    { env, encoding: "utf8", cwd: path.resolve(__dirname, ".."), shell: true },
  );
  const combined = `${child.stdout}\n${child.stderr}`;
  assert(child.status !== 0, "encrypt module should fail to load without a key");
  assert(
    /ENCRYPTION_KEY or SETTINGS_ENCRYPTION_KEY must be set/.test(combined),
    `expected key error, got: ${combined.slice(0, 500)}`,
  );

  // Seed: no admin when ADMIN_EMAIL is unset.
  const created: string[] = [];
  const skipped = await seedBootstrapAdmin(
    {
      user: {
        findUnique: async () => null,
        create: async ({ data }) => {
          created.push(data.email as string);
          return data as never;
        },
      },
    },
    { ADMIN_EMAIL: undefined, ADMIN_PASSWORD: "x" },
  );
  assert(skipped === "skipped", "unset ADMIN_EMAIL must skip");
  assert(created.length === 0, "must not create an admin when env is unset");

  // Seed: existing user role/password untouched.
  let createCalled = false;
  let existingRole: Role = Role.CONTENT_MANAGER;
  const exists = await seedBootstrapAdmin(
    {
      user: {
        findUnique: async () => ({ id: "u1", email: "admin@example.test", role: existingRole }),
        create: async () => {
          createCalled = true;
          existingRole = Role.SUPER_ADMIN;
          return {} as never;
        },
      },
    },
    { ADMIN_EMAIL: "admin@example.test", ADMIN_PASSWORD: "new-password" },
  );
  assert(exists === "exists", "existing admin must not be recreated");
  assert(!createCalled, "must not create when user exists");
  assert(existingRole === Role.CONTENT_MANAGER, "must not change role of an existing user");

  console.log("test-payment-bind: all assertions passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
