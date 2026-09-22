/**
 * Slice AZ8: STAFF do not receive receipt URLs or payments, and see a client's
 * measurements only when they cut or tailor that client's garment — enforced
 * in the API response.
 *
 *   pnpm test:staff-data-access                         # unit only (CI)
 *   ALLOW_FIXTURES=true BASE_URL=http://localhost:3000 pnpm test:staff-data-access
 *
 * The live part calls the real API with signed Auth.js sessions for two STAFF
 * users (a beader and a tailor). The payment ledger is append-only, so the
 * order/client/payment fixture is permanent and reused (looked up by fixed
 * identifiers, created once). Refuses production and staging databases.
 */
import "./preload-test-env";
import { BespokeStage, OrderStatus, PaymentMethod, PaymentPurpose, PaymentStatus, Role, StaffDepartment } from "@prisma/client";
import { encode } from "next-auth/jwt";
import { prisma } from "../src/lib/prisma";
import { appendPayment } from "../src/lib/payments/ledger";
import { canSeePaymentDetails, redactBespokeOrder } from "../src/lib/bespoke-data-access";
import { assertFixturesAllowed } from "./fixture-guard";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const RECEIPT = "/media/private/az8-fixture/receipt-do-not-leak.jpg";
const FIXTURE = {
  clientEmail: "az8-fixture-client@example.test",
  orderRef: "AZ8-FIXTURE-0001",
  paymentRef: "AZ8-FIXTURE-PAY-0001",
  beader: "az8-fixture-beader@example.test",
  tailor: "az8-fixture-tailor@example.test",
  manager: "az8-fixture-manager@example.test",
};

function unit() {
  assert(!canSeePaymentDetails({ role: "STAFF", email: "s@example.test" }), "STAFF may not see payments");
  assert(canSeePaymentDetails({ role: "BESPOKE_MANAGER", email: "m@example.test" }), "bespoke manager sees payments");
  assert(canSeePaymentDetails({ role: "FINANCE_MANAGER", email: "f@example.test" }), "finance sees payments");
  const order = {
    payments: [{ id: "p1", receiptUrl: RECEIPT }],
    clientProfile: { id: "c1", measurements: { bust: 36 } },
  };
  const hidden = redactBespokeOrder(order, { payments: false, measurements: false });
  assert(hidden.payments?.length === 0 && hidden.paymentsHidden, "payments stripped");
  assert(hidden.clientProfile?.measurements === null && hidden.measurementsHidden, "measurements stripped");
  assert(!JSON.stringify(hidden).includes(RECEIPT), "no receipt URL survives redaction");
  const shown = redactBespokeOrder(order, { payments: true, measurements: true });
  assert(shown.payments?.length === 1 && !shown.paymentsHidden && !shown.measurementsHidden, "managers keep both");
  console.log("ok unit: access rules and redaction");
}

async function upsertStaff(email: string, department: StaffDepartment) {
  const user = await prisma.user.upsert({
    where: { email },
    update: { role: Role.STAFF, isStaff: true },
    create: { email, name: `AZ8 ${department}`, role: Role.STAFF, isStaff: true, password: "x" },
  });
  const staff = await prisma.staffProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id, department },
  });
  return { user, staff };
}

async function fixture() {
  const clientUser = await prisma.user.upsert({
    where: { email: FIXTURE.clientEmail },
    update: {},
    create: { email: FIXTURE.clientEmail, name: "AZ8 Fixture Client", role: Role.CUSTOMER, password: "x" },
  });
  const client = await prisma.clientProfile.upsert({
    where: { userId: clientUser.id },
    update: {},
    create: { userId: clientUser.id },
  });
  await prisma.measurement.upsert({
    where: { clientId: client.id },
    update: { bust: 36 },
    create: { clientId: client.id, bust: 36, waist: 28 },
  });
  const order =
    (await prisma.bespokeOrder.findFirst({ where: { orderRef: FIXTURE.orderRef } })) ??
    (await prisma.bespokeOrder.create({
      data: {
        orderRef: FIXTURE.orderRef,
        clientProfileId: client.id,
        clientName: "AZ8 Fixture Client",
        clientEmail: FIXTURE.clientEmail,
        currentStage: BespokeStage.FINAL_FITTING,
        status: OrderStatus.PROCESSING,
        totalAmount: 100_000,
        balance: 50_000,
      },
    }));
  if (!(await prisma.payment.findUnique({ where: { reference: FIXTURE.paymentRef } }))) {
    await appendPayment({
      reference: FIXTURE.paymentRef,
      amount: 50_000,
      method: PaymentMethod.BANK_TRANSFER,
      status: PaymentStatus.CONFIRMED,
      purpose: PaymentPurpose.DEPOSIT,
      receiptUrl: RECEIPT,
      bespokeOrderId: order.id,
      clientId: clientUser.id,
    });
  }
  const beader = await upsertStaff(FIXTURE.beader, StaffDepartment.BEADER);
  const tailor = await upsertStaff(FIXTURE.tailor, StaffDepartment.TAILOR);
  for (const [s, role] of [[beader, "BEADER"], [tailor, "TAILOR"]] as const) {
    const has = await prisma.orderAssignment.findFirst({ where: { orderId: order.id, staffProfileId: s.staff.id } });
    if (!has) await prisma.orderAssignment.create({ data: { orderId: order.id, staffProfileId: s.staff.id, role } });
  }
  return { order, client, beader: beader.user, tailor: tailor.user };
}

async function cookieFor(user: { id: string; email: string }, secure: boolean) {
  const name = secure ? "__Secure-authjs.session-token" : "authjs.session-token";
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  assert(secret, "AUTH_SECRET is set for the local server");
  const token = await encode({
    token: { id: user.id, sub: user.id, email: user.email, role: "STAFF", iat: Math.floor(Date.now() / 1000) },
    secret,
    salt: name,
  });
  return `${name}=${token}`;
}

async function live(base: string) {
  const host = new URL(base).hostname;
  assert(host === "localhost" || host === "127.0.0.1", "live checks need the server's own database (localhost only)");
  assertFixturesAllowed("test-staff-data-access");
  const { order, client, beader, tailor } = await fixture();
  const secure = base.startsWith("https://");

  const get = async (path: string, cookie: string) => {
    const res = await fetch(base + path, { headers: { cookie } });
    return { status: res.status, text: await res.text() };
  };

  const beaderCookie = await cookieFor({ id: beader.id, email: beader.email }, secure);
  const tailorCookie = await cookieFor({ id: tailor.id, email: tailor.email }, secure);

  // Beader: assigned, but neither money nor measurements.
  const b = await get(`/api/bespoke/${order.id}`, beaderCookie);
  assert(b.status === 200, `beader reads the order (${b.status})`);
  assert(!b.text.includes(RECEIPT), "STAFF (beader) is refused the receipt URL");
  const bItem = (JSON.parse(b.text) as { item: { payments: unknown[]; paymentsHidden: boolean; clientProfile: { measurements: unknown } } }).item;
  assert(bItem.payments.length === 0 && bItem.paymentsHidden, "beader gets no payments");
  assert(bItem.clientProfile.measurements === null, "beader gets no measurements");

  // Tailor: cuts the garment → measurements, still no money.
  const t = await get(`/api/bespoke/${order.id}`, tailorCookie);
  assert(t.status === 200 && !t.text.includes(RECEIPT), "STAFF (tailor) is refused the receipt URL");
  const tItem = (JSON.parse(t.text) as { item: { payments: unknown[]; clientProfile: { measurements: { bust: number } | null } } }).item;
  assert(tItem.payments.length === 0, "tailor gets no payments");
  assert(tItem.clientProfile.measurements?.bust === 36, "tailor gets measurements");

  // Client profile: same rules.
  const bc = await get(`/api/clients/${client.id}`, beaderCookie);
  const bcItem = (JSON.parse(bc.text) as { item: { measurements: unknown; payments: unknown[] } }).item;
  assert(bc.status === 200 && bcItem.measurements === null && bcItem.payments.length === 0, "client profile: beader sees neither");
  const tc = await get(`/api/clients/${client.id}`, tailorCookie);
  const tcItem = (JSON.parse(tc.text) as { item: { measurements: { bust: number } | null } }).item;
  assert(tcItem.measurements?.bust === 36, "client profile: tailor sees measurements");

  // Recording measurements: beader refused, tailor allowed.
  const patch = (cookie: string) =>
    fetch(`${base}/api/clients/${client.id}/measurements`, {
      method: "PATCH",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ bust: 36 }),
    });
  assert((await patch(beaderCookie)).status === 403, "beader may not record measurements");
  assert((await patch(tailorCookie)).status === 200, "tailor may record measurements");

  // A bespoke manager still gets the payment and its receipt (nothing over-redacted).
  const manager = await prisma.user.upsert({
    where: { email: FIXTURE.manager },
    update: { role: Role.BESPOKE_MANAGER },
    create: { email: FIXTURE.manager, name: "AZ8 Manager", role: Role.BESPOKE_MANAGER, password: "x" },
  });
  const m = await get(`/api/bespoke/${order.id}`, await cookieFor({ id: manager.id, email: manager.email }, secure));
  assert(m.status === 200 && m.text.includes(RECEIPT), "bespoke manager still receives the receipt URL");
  assert(/"bust":36/.test(m.text), "bespoke manager still receives measurements");

  // Staff portal view.
  const sp = await get(`/api/staff/orders/${order.id}`, beaderCookie);
  assert(sp.status === 200 && (JSON.parse(sp.text) as { measurements: unknown }).measurements === null, "staff portal: beader gets no measurements");
  console.log("ok live: STAFF refused receipts at the API; measurements only for the tailor");
}

async function main() {
  unit();
  const base = process.env.BASE_URL?.replace(/\/$/, "");
  if (base) await live(base);
  else console.log("skip live checks: set ALLOW_FIXTURES=true BASE_URL=http://localhost:…");
  console.log("OK test-staff-data-access");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
