/**
 * Bespoke balance link: underpayment, foreign reference, currency, and double fulfilment.
 * No database — uses an in-memory transaction stub.
 *
 *   pnpm test:bespoke-balance-bind
 */
import "./preload-test-env";
import { PaymentGateway, PaymentStatus } from "@prisma/client";
import { PaymentBindError } from "../src/lib/payment-bind";
import { fulfillPaidBespokeBalance } from "../src/lib/bespoke-payment";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

async function expectBindError(code: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    assert(e instanceof PaymentBindError, `expected PaymentBindError, got ${e}`);
    assert(e.code === code, `expected ${code}, got ${e.code}`);
    return;
  }
  throw new Error(`FAIL: expected ${code} to throw`);
}

const REF = "BESP-PB2600042";

/** agreedPrice ₦2,000,000, deposit ₦500,000 → balance ₦1,500,000 = 150,000,000 kobo. */
function makeDb() {
  const row = {
    id: "besp_1",
    agreedPrice: 2_000_000,
    depositPaid: 500_000 as number | null,
    adminNotes: null as string | null,
    balancePaystackRef: REF,
    balancePaymentStatus: PaymentStatus.PENDING as PaymentStatus,
  };
  const tx = {
    bespokeRequest: {
      findFirst: async (args: { where: { balancePaymentStatus: PaymentStatus } }) =>
        row.balancePaymentStatus === args.where.balancePaymentStatus ? { ...row } : null,
      updateMany: async (args: {
        where: { balancePaymentStatus: PaymentStatus };
        data: { balancePaymentStatus: PaymentStatus; depositPaid: number };
      }) => {
        await Promise.resolve();
        if (row.balancePaymentStatus !== args.where.balancePaymentStatus) return { count: 0 };
        row.balancePaymentStatus = args.data.balancePaymentStatus;
        row.depositPaid = args.data.depositPaid;
        return { count: 1 };
      },
    },
  };
  const db = { $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) };
  return { row, db: db as never };
}

function pay(db: never, charge: { reference?: string; amount?: number; currency?: string }) {
  return fulfillPaidBespokeBalance({
    bespokeRequestId: "besp_1",
    gateway: PaymentGateway.PAYSTACK,
    db,
    charge: {
      reference: charge.reference ?? REF,
      amount: charge.amount ?? 150_000_000,
      currency: charge.currency ?? "NGN",
    },
  });
}

async function main() {
  // ₦100 charge against a ₦1.5M balance is rejected and leaves the row PENDING.
  {
    const { row, db } = makeDb();
    await expectBindError("AMOUNT_MISMATCH", () => pay(db, { amount: 10_000 }));
    assert(row.balancePaymentStatus === PaymentStatus.PENDING, "underpay must not mark PAID");
  }

  // A self-made checkout (own reference, forged metadata) is rejected even at full amount.
  {
    const { row, db } = makeDb();
    await expectBindError("REFERENCE_MISMATCH", () =>
      pay(db, { reference: "attacker-ref-1" }),
    );
    assert(row.balancePaymentStatus === PaymentStatus.PENDING, "foreign ref must not mark PAID");
  }

  // Wrong currency: USD 1,500,000 cents is not ₦1.5M.
  {
    const { db } = makeDb();
    await expectBindError("CURRENCY_MISMATCH", () => pay(db, { currency: "USD" }));
  }

  // Correct charge pays; webhook + redirect racing fulfil exactly once.
  {
    const { row, db } = makeDb();
    const results = await Promise.all([pay(db, {}), pay(db, {})]);
    assert(results.filter(Boolean).length === 1, `expected one fulfilment, got ${results}`);
    assert(row.balancePaymentStatus === PaymentStatus.PAID, "full charge should mark PAID");
    assert(row.depositPaid === 2_000_000, "depositPaid should equal agreedPrice");
  }

  console.log("OK test-bespoke-balance-bind");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
