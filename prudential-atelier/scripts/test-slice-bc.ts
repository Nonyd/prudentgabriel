/**
 * Slice BC: the client file, what the gown is, delivery months, where clients are.
 *
 *   pnpm test:slice-bc                          # unit only (CI, no database)
 *   ALLOW_FIXTURES=true pnpm test:slice-bc      # + database checks (dev only)
 *
 * The database part builds a client with two commissions, a tailor and a
 * beader, and asks the client-file composer (the code behind
 * GET /api/clients/:id/file) what each viewer gets, then runs the pipeline's
 * own search for gown features and delivery months. It cleans up after itself.
 */
import "./preload-test-env";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Role, StaffDepartment } from "@prisma/client";
import { hasPermission, type AccessActor } from "../src/lib/roles";
import { accessRuleForAdminPath } from "../src/lib/admin-route-access";
import {
  canPreviewClientDashboard,
  clientFileAccess,
  composeClientFile,
  deliveryConfirmation,
  workroomStageLabel,
  type FileViewer,
} from "../src/lib/client-file";
import {
  deliveryMonthOf,
  deliveryMonthRange,
  parseDeliveryDateInput,
  parseDeliveryMonth,
} from "../src/lib/atelier/delivery-month";
import { commissionSearch } from "../src/lib/atelier/commission-search";
import { featureKeyFromLabel, parseFeatureKeys, parseSpecItems } from "../src/lib/atelier/construction-features";
import { groupClientsByPlace, normaliseState } from "../src/lib/client-places";
import { redactBespokeOrder, stripOrderReceipt } from "../src/lib/bespoke-data-access";
import {
  CLIENT_INTAKE_NOTE,
  clientStageNote,
  intakeStageNotes,
  invoiceIssuanceNote,
  paymentConfirmationNote,
} from "../src/lib/atelier/intake-stages";
import { clientStageHistory } from "../src/lib/atelier/live-stages";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

type Who = { label: string; role: string; actor?: AccessActor; assignments?: { orderId: string; role: string }[] };

function viewer(w: Who): FileViewer {
  const actor: AccessActor = { email: null, ...w.actor };
  return {
    userId: `u-${w.label}`,
    role: w.role,
    email: null,
    allows: (p) => hasPermission(w.role, p, actor),
    assignments: w.assignments ?? [],
  };
}

/** The six people the brief names, with the permissions they hold today. */
const PEOPLE: Who[] = [
  { label: "Mrs. Prudent (ADMIN)", role: "ADMIN" },
  { label: "Kemi (RTW_MANAGER + atelier grant)", role: "RTW_MANAGER", actor: { grants: ["bespoke", "consultations"] } },
  { label: "Bespoke manager (seed: clients.view)", role: "BESPOKE_MANAGER" },
  { label: "Bespoke manager (+ T3 clients)", role: "BESPOKE_MANAGER", actor: { grants: ["clients"] } },
  { label: "Assigned tailor (STAFF)", role: "STAFF", assignments: [{ orderId: "o1", role: "TAILOR" }] },
  { label: "Assigned beader (STAFF)", role: "STAFF", assignments: [{ orderId: "o1", role: "BEADER" }] },
  { label: "Store manager", role: "STORE_MANAGER" },
];

function unit() {
  // ── BC1: the file composes per viewer; it never widens ──
  const matrix = PEOPLE.map((p) => ({ who: p.label, ...clientFileAccess(viewer(p)) }));
  const row = (label: string) => matrix.find((m) => m.who === label)!;

  const admin = row("Mrs. Prudent (ADMIN)");
  assert(admin.admitted && admin.scope === "house" && admin.contact, "Mrs. Prudent opens the whole file");
  assert(Object.values(admin.sections).every(Boolean), "Mrs. Prudent sees every section");

  const kemi = row("Kemi (RTW_MANAGER + atelier grant)");
  assert(!kemi.admitted, "Kemi has no clients key, so the file is not open to her (as /admin/clients today)");
  assert(!kemi.sections.payments && !kemi.sections.measurements, "Kemi never gets payments or measurements");

  const bmSeed = row("Bespoke manager (seed: clients.view)");
  assert(!bmSeed.admitted, "a bespoke manager on the seed set cannot open /admin/clients, so not the file");
  const bm = row("Bespoke manager (+ T3 clients)");
  assert(bm.admitted && bm.sections.measurements && bm.sections.payments, "bespoke manager with clients: measurements + payments");
  assert(bm.sections.consultation, "bespoke manager holds consultations");
  assert(bm.sections.quotation, "bespoke manager is a money role, so the quotation shows");

  const tailor = row("Assigned tailor (STAFF)");
  assert(tailor.admitted && tailor.scope === "workroom", "tailor reaches the file for the gown she is on");
  assert(tailor.sections.measurements, "AZ8: the tailor sees measurements");
  assert(!tailor.sections.payments, "AZ8: STAFF are refused payments");
  assert(!tailor.sections.quotation, "STAFF do not get the quotation");
  assert(!tailor.contact, "STAFF get her first name, not her contact details");

  const beader = row("Assigned beader (STAFF)");
  assert(beader.admitted && !beader.sections.measurements, "AZ8: a beader is refused measurements");
  assert(!beader.sections.payments, "AZ8: a beader is refused payments");
  assert(beader.sections.specification && beader.sections.illustrations, "the workroom sees the gown and the sketches");

  const store = row("Store manager");
  assert(!store.admitted, "a store manager does not reach client files");

  const unassigned = clientFileAccess(viewer({ label: "floor", role: "STAFF" }));
  assert(!unassigned.admitted, "STAFF with no assignment on her gown are refused");

  const revoked = clientFileAccess(viewer({ label: "rev", role: "ADMIN", actor: { revokes: ["consultations"] } }));
  assert(revoked.admitted && !revoked.sections.consultation, "a REVOKE on consultations hides the consultation section");

  // ── "Preview her dashboard": only for someone who already sees all of her file ──
  assert(canPreviewClientDashboard(admin), "Mrs. Prudent can preview a client's dashboard");
  assert(canPreviewClientDashboard(bm), "a bespoke manager with clients sees her whole file, so can preview");
  for (const m of [kemi, bmSeed, tailor, beader, store, unassigned]) {
    assert(!canPreviewClientDashboard(m), "the preview stays closed to anyone without her whole file");
  }
  assert(!canPreviewClientDashboard(revoked), "an admin with consultations revoked cannot preview: the dashboard shows consultations");
  // ── What her tracker says on the intake stages: her words, not the house's record ──
  const convert = intakeStageNotes({ quoteRef: "QT-2026-0001", invoiceNumber: "INV-1", bookingNumber: "PB-1", consultationPaid: true, consultationPaymentRef: "PS-1" });
  for (const [stage, note] of Object.entries(convert)) {
    assert(clientStageNote(stage, note) === CLIENT_INTAKE_NOTE, `she does not see the convert note on ${stage}`);
  }
  assert(clientStageNote("INVOICE_ISSUANCE", invoiceIssuanceNote({ invoiceNumber: "INV-1", quoteRef: "QT-1", sent: true })) === CLIENT_INTAKE_NOTE, "nor the invoice-sent note");
  assert(clientStageNote("PAYMENT_CONFIRMATION", paymentConfirmationNote({ depositSatisfied: true })) === CLIENT_INTAKE_NOTE, "nor the deposit note");
  assert(clientStageNote("CONSULTATION_SESSION", "Lovely to meet you — sketches by Friday.") === "Lovely to meet you — sketches by Friday.", "a note typed for her on an intake stage stays");
  assert(clientStageNote("TAILORING", "Completed at convert — x") === "Completed at convert — x", "only intake stages are rewritten");
  const shown = clientStageHistory(
    [
      { stage: "CONSULTATION_BOOKING" as const, notes: convert.CONSULTATION_BOOKING },
      { stage: "TAILORING" as const, notes: "Bodice cut." },
    ],
    new Set(["CONSULTATION_BOOKING", "TAILORING"] as const),
  );
  assert(shown[0]!.notes === CLIENT_INTAKE_NOTE && shown[1]!.notes === "Bodice cut.", "her stage history carries her words");

  const previewGate = accessRuleForAdminPath("/admin/clients/c1/dashboard");
  assert(
    previewGate?.type === "permission" && previewGate.permission === "clients",
    "the preview page sits behind the clients gate, like the file",
  );

  console.log("\nWho sees what on the client file:");
  console.table(
    matrix.map((m) => ({
      viewer: m.who,
      opens: m.admitted ? m.scope : "no (403)",
      consult: m.sections.consultation ? "yes" : "-",
      measure: m.sections.measurements ? "yes" : "-",
      gown: m.sections.specification ? "yes" : "-",
      quote: m.sections.quotation ? "yes" : "-",
      pay: m.sections.payments ? "yes" : "-",
      sketch: m.sections.illustrations ? "yes" : "-",
      making: m.sections.making ? "yes" : "-",
      delivery: m.sections.delivery ? (m.contact ? "yes+address" : "date only") : "-",
      preview: canPreviewClientDashboard(m) ? "yes" : "-",
    })),
  );

  assert(workroomStageLabel("TAILORING") === "Cutting & sewing", "the house says cutting and sewing");
  assert(
    deliveryConfirmation({ deliveryDate: new Date(), deliveredAt: new Date(), receiptConfirmedAt: null }) ===
      "DELIVERED_AWAITING_CLIENT",
    "delivered, not yet confirmed",
  );

  // AZ8 gap closed in this slice: the order row's own receipt.
  const order = { payments: [{ id: "p" }], paymentReceiptUrl: "/media/private/r.jpg", paymentRef: "PAY-1", clientProfile: null };
  const hidden = redactBespokeOrder(order, { payments: false, measurements: false });
  assert(hidden.paymentReceiptUrl === null && hidden.paymentRef === null, "order-level receipt is stripped for non-money viewers");
  assert(redactBespokeOrder(order, { payments: true, measurements: true }).paymentReceiptUrl, "money roles keep it");
  assert(stripOrderReceipt({ id: "x" } as { id: string; paymentReceiptUrl?: string | null }).paymentReceiptUrl === undefined, "absent stays absent");

  // ── BC2: the specification ──
  assert(featureKeyFromLabel("Cup corset") === "cup_corset", "label → key");
  assert(featureKeyFromLabel("  Long Sleeves! ") === "long_sleeves", "punctuation dropped");
  assert(parseFeatureKeys("cup_corset, train,,cup_corset,DROP;x").join() === "cup_corset,train", "feature keys parsed");
  const spec = parseSpecItems({ items: [{ featureId: "a", note: " detachable " }, { featureId: "a" }, { featureId: "b" }] });
  assert(spec.ok && spec.items.length === 2 && spec.items[0].note === "detachable", "spec items deduped, notes trimmed");
  assert(!parseSpecItems({ items: [{ note: "x" }] }).ok, "a spec item needs a feature");
  const featureQuery = commissionSearch(new URLSearchParams("feature=cup_corset"));
  assert(featureQuery.ok && JSON.stringify(featureQuery.where).includes("cup_corset"), "feature search builds a query");

  // ── BC3: delivery months, in Lagos time ──
  const may = parseDeliveryMonth("2026-05");
  assert(may && may.year === 2026 && may.month === 5, "2026-05 parses");
  assert(parseDeliveryMonth("2026-13") === null && parseDeliveryMonth("May") === null, "bad months refused");
  const range = deliveryMonthRange(may!);
  assert(range.gte.toISOString() === "2026-04-30T23:00:00.000Z", "May starts at Lagos midnight");
  assert(range.lt.toISOString() === "2026-05-31T23:00:00.000Z", "June starts at Lagos midnight");
  const dec = deliveryMonthRange({ year: 2026, month: 12 });
  assert(dec.lt.toISOString() === "2026-12-31T23:00:00.000Z", "December rolls into January");
  const lateApril = deliveryMonthOf(new Date("2026-04-30T23:30:00Z"));
  assert(lateApril.month === 5, "23:30 UTC on 30 April is already May in Lagos");
  const may31 = parseDeliveryDateInput("2026-05-31")!;
  assert(may31 >= range.gte && may31 < range.lt, "a date picked as 31 May is in May");
  assert(parseDeliveryDateInput("2026-02-30") === undefined, "impossible dates refused");
  assert(parseDeliveryDateInput("") === null && parseDeliveryDateInput(null) === null, "empty clears");
  assert(parseDeliveryDateInput("next week") === undefined, "free text refused");
  const badMonth = commissionSearch(new URLSearchParams("deliveryMonth=2026-5"));
  assert(!badMonth.ok, "the list answers 400 for a malformed month");
  const monthQuery = commissionSearch(new URLSearchParams("deliveryMonth=2026-05"));
  assert(monthQuery.ok && monthQuery.orderBy[0] && "deliveryDate" in monthQuery.orderBy[0], "a month reads soonest first");

  // ── BC4: where clients are ──
  assert(normaliseState("lagos state") === "Lagos" && normaliseState("Abuja FCT") === "FCT", "states normalised");
  const places = groupClientsByPlace([
    { clientId: "1", hasCommission: true, country: "Nigeria", state: "Lagos", city: "Lekki" },
    { clientId: "2", hasCommission: false, country: "NG", state: "lagos state", city: "lekki" },
    { clientId: "3", hasCommission: true, country: "nigeria", state: "FCT", city: "Abuja" },
    { clientId: "4", hasCommission: false, country: "UK", state: null, city: "London" },
    { clientId: "5", hasCommission: false, country: null, state: null, city: null },
  ]);
  assert(places.total === 5 && places.notRecorded === 1 && places.located === 4, "totals");
  const ng = places.countries[0]!;
  assert(ng.name === "Nigeria" && ng.clients === 3 && ng.withCommission === 2, "Nigeria counted once across spellings");
  assert(ng.states[0]!.name === "Lagos" && ng.states[0]!.clients === 2, "Lagos first with 2");
  assert(ng.states[0]!.cities[0]!.name === "Lekki" && ng.states[0]!.cities[0]!.clients === 2, "Lekki merged");
  assert(places.countries.at(-1)!.name === "Not recorded", "not recorded sorts last");
  assert(!JSON.stringify(places).includes("clientId"), "counts only — no client ids leave the function");

  // ── Wiring ──
  const fileRoute = read("src/app/api/clients/[clientId]/file/route.ts");
  assert(fileRoute.includes("composeClientFile") && fileRoute.includes("resolveSessionAccess"), "file route composes per viewer");
  const gate = accessRuleForAdminPath("/admin/clients/places");
  assert(gate?.type === "permission" && JSON.stringify(gate.permission) === JSON.stringify(["clients", "reports"]), "places page: clients or reports");
  assert(read("src/app/api/admin/clients/places/route.ts").includes('requireAdminApi(["clients", "reports"])'), "places API: same gate");
  assert(read("src/lib/quotation-convert.ts").includes("deliveryDate: quote.expectedDeliveryDate"), "convert carries the agreed date");
  assert(read("src/app/(admin)/admin/bespoke/[orderId]/page.tsx").includes("redactBespokeOrder"), "admin commission page applies AZ8");
  assert(read("src/app/api/bespoke/[orderId]/complete-stage/route.ts").includes("redactBespokeOrder"), "complete-stage applies AZ8");
  assert(read("src/components/admin/BespokeOrderDetailClient.tsx").includes('value="PATTERN_CUTTER"'), "pattern cutter can be assigned");
  assert(read("prisma/migrations/20260930_slice_bc_client_file/migration.sql").includes("'cup_corset'"), "meeting features seeded");

  console.log("ok unit");
}

async function db() {
  const { assertFixturesAllowed } = await import("./fixture-guard");
  assertFixturesAllowed("test-slice-bc");
  const { prisma } = await import("../src/lib/prisma");
  const { convertQuotationToOrder } = await import("../src/lib/quotation-convert");

  const stamp = `bc-${Date.now()}`;
  const emails = {
    client: `${stamp}-client@example.test`,
    tailor: `${stamp}-tailor@example.test`,
    beader: `${stamp}-beader@example.test`,
    floor: `${stamp}-floor@example.test`,
  };
  const orderIds: string[] = [];
  const quoteIds: string[] = [];
  const invoiceIds: string[] = [];
  const featureIds: string[] = [];

  try {
    const clientUser = await prisma.user.create({
      data: { email: emails.client, name: "Adaeze BC Fixture", role: Role.CUSTOMER, password: "x" },
    });
    const client = await prisma.clientProfile.create({ data: { userId: clientUser.id } });
    await prisma.measurement.create({ data: { clientId: client.id, bust: 91.7, waist: 71.3, unit: "cm" } });
    await prisma.address.create({
      data: {
        userId: clientUser.id,
        firstName: "Adaeze",
        lastName: "Fixture",
        phone: "0800",
        street: "1 Test Close",
        city: "Lekki",
        state: "Lagos State",
        country: "Nigeria",
        isDefault: true,
      },
    });

    const features = await prisma.constructionFeature.findMany({
      where: { key: { in: ["mermaid", "cup_corset", "train", "long_sleeves"] } },
    });
    assert(features.length === 4, "the four meeting features are seeded by the migration");
    const byKey = new Map(features.map((f) => [f.key, f]));

    // A feature the house adds later, without a deploy.
    const added = await prisma.constructionFeature.create({
      data: { key: `${stamp.replace(/-/g, "_")}_illusion`, label: "Illusion neckline", group: "Neckline", sortOrder: 999 },
    });
    featureIds.push(added.id);

    const mkOrder = (ref: string, deliveryDate: string) =>
      prisma.bespokeOrder.create({
        data: {
          orderRef: ref,
          clientProfileId: client.id,
          clientName: "Adaeze BC Fixture",
          clientEmail: emails.client,
          deliveryDate: parseDeliveryDateInput(deliveryDate)!,
          currentStage: "TAILORING",
          paymentReceiptUrl: "/media/private/bc-fixture/receipt-do-not-leak.jpg",
        },
      });
    const may = await mkOrder(`BC-${stamp}-MAY`, "2026-05-31");
    const june = await mkOrder(`BC-${stamp}-JUN`, "2026-06-01");
    orderIds.push(may.id, june.id);

    await prisma.commissionFeature.createMany({
      data: [
        { orderId: may.id, featureId: byKey.get("mermaid")!.id },
        { orderId: may.id, featureId: byKey.get("cup_corset")!.id, note: "boned, detachable straps" },
        { orderId: may.id, featureId: added.id },
        { orderId: june.id, featureId: byKey.get("train")!.id },
        { orderId: june.id, featureId: byKey.get("long_sleeves")!.id },
      ],
    });

    const staff = async (email: string, dept: StaffDepartment) => {
      const u = await prisma.user.create({ data: { email, name: `BC ${dept}`, role: Role.STAFF, isStaff: true, password: "x" } });
      const p = await prisma.staffProfile.create({ data: { userId: u.id, department: dept } });
      return { user: u, profile: p };
    };
    const tailor = await staff(emails.tailor, StaffDepartment.TAILOR);
    const beader = await staff(emails.beader, StaffDepartment.BEADER);
    const floor = await staff(emails.floor, StaffDepartment.GENERAL);
    await prisma.orderAssignment.createMany({
      data: [
        { orderId: may.id, staffProfileId: tailor.profile.id, role: "TAILOR", stage: "TAILORING" },
        { orderId: may.id, staffProfileId: beader.profile.id, role: "BEADER", stage: "BEADING_FINISHING" },
      ],
    });

    const as = (userId: string, role: string, actor: AccessActor = {}) => ({
      userId,
      role,
      email: null,
      allows: (p: Parameters<FileViewer["allows"]>[0]) => hasPermission(role, p, actor),
    });

    // ── A beader is refused measurements at the API on this page ──
    const beaderMeasure = await composeClientFile(as(beader.user.id, "STAFF"), client.id, "measurements");
    assert(beaderMeasure.status === 403, `beader measurements → 403 (got ${beaderMeasure.status})`);
    const beaderFile = await composeClientFile(as(beader.user.id, "STAFF"), client.id);
    assert(beaderFile.status === 200, "the beader still opens the file for her gown");
    const beaderJson = JSON.stringify(beaderFile.body);
    assert(!beaderJson.includes("91.7") && !beaderJson.includes("71.3"), "no measurement value reaches the beader");
    assert(beaderJson.includes("Measurements are kept for managers"), "the beader is told the section exists and why");
    assert(!beaderJson.includes(emails.client), "the beader does not get her email");
    assert(!beaderJson.includes(june.orderRef), "the beader sees only the gown she is on");
    assert(beaderJson.includes("Cup corset"), "the beader sees the specification");

    // ── STAFF are refused payments ──
    for (const who of [tailor, beader]) {
      const pay = await composeClientFile(as(who.user.id, "STAFF"), client.id, "payments");
      assert(pay.status === 403, `STAFF payments → 403 (got ${pay.status})`);
      const full = JSON.stringify((await composeClientFile(as(who.user.id, "STAFF"), client.id)).body);
      assert(!full.includes("receipt-do-not-leak"), "no receipt URL reaches STAFF");
    }

    const tailorMeasure = await composeClientFile(as(tailor.user.id, "STAFF"), client.id, "measurements");
    assert(tailorMeasure.status === 200 && JSON.stringify(tailorMeasure.body).includes("91.7"), "the tailor gets measurements");

    const floorFile = await composeClientFile(as(floor.user.id, "STAFF"), client.id);
    assert(floorFile.status === 403, "STAFF not on her gown are refused the file");
    const storeFile = await composeClientFile(as(floor.user.id, "STORE_MANAGER"), client.id);
    assert(storeFile.status === 403, "a store manager is refused the file");
    const kemiFile = await composeClientFile(
      as(floor.user.id, "RTW_MANAGER", { grants: ["bespoke", "consultations"] }),
      client.id,
    );
    assert(kemiFile.status === 403, "Kemi (no clients key) is refused the file");

    const adminFile = await composeClientFile(as(clientUser.id, "ADMIN"), client.id);
    assert(adminFile.status === 200, "Mrs. Prudent opens the file");
    const adminJson = JSON.stringify(adminFile.body);
    assert(adminJson.includes("91.7") && adminJson.includes(june.orderRef), "Mrs. Prudent sees measurements and both gowns");
    assert(adminJson.includes("Lekki") && adminJson.includes("Cutting & sewing"), "address and the house's words");
    const adminPay = await composeClientFile(as(clientUser.id, "ADMIN"), client.id, "payments");
    assert(adminPay.status === 200, "Mrs. Prudent sees payments");
    console.log("ok db: client file per viewer");

    // ── A gown's specification is searchable ──
    const ours = { id: { in: orderIds } };
    const search = async (qs: string) => {
      const q = commissionSearch(new URLSearchParams(qs));
      assert(q.ok, `query ${qs}`);
      const rows = await prisma.bespokeOrder.findMany({ where: { AND: [q.where, ours] }, orderBy: q.orderBy, select: { id: true } });
      return rows.map((r) => r.id);
    };
    assert((await search("feature=cup_corset")).join() === may.id, "which gowns had a cup corset → May's");
    assert((await search("feature=train")).join() === june.id, "which had a train → June's");
    assert((await search("feature=mermaid,cup_corset")).join() === may.id, "mermaid AND cup corset");
    assert((await search("feature=cup_corset,train")).length === 0, "nothing had both a cup corset and a train");
    assert((await search(`feature=${added.key}`)).join() === may.id, "a house-added feature is searchable at once");
    console.log("ok db: specification search");

    // ── Delivery-month search returns the right commissions ──
    assert((await search("deliveryMonth=2026-05")).join() === may.id, "May: the 31 May gown, not the 1 June one");
    assert((await search("deliveryMonth=2026-06")).join() === june.id, "June: the 1 June gown");
    assert((await search("deliveryMonth=2026-07")).length === 0, "July: none");
    assert((await search("deliveryMonth=2026-05&feature=cup_corset")).join() === may.id, "month and feature together");
    console.log("ok db: delivery-month search");

    // ── The agreed date travels from quotation to commission ──
    const quote = await prisma.quotation.create({
      data: {
        quoteRef: `QT-${stamp}`,
        baseQuoteRef: `QT-${stamp}`,
        clientName: "Adaeze BC Fixture",
        clientEmail: emails.client,
        lineItems: [{ description: "Bridal gown", quantity: 1, unitPrice: 1000, total: 1000 }],
        subtotal: 1000,
        total: 1000,
        status: "APPROVED",
        approvedAt: new Date(),
        expectedDeliveryDate: parseDeliveryDateInput("2026-05-14")!,
      },
    });
    quoteIds.push(quote.id);
    const converted = await convertQuotationToOrder(quote);
    orderIds.push(converted.orderId);
    invoiceIds.push(converted.invoiceId);
    const made = await prisma.bespokeOrder.findUnique({ where: { id: converted.orderId }, select: { deliveryDate: true } });
    assert(made?.deliveryDate?.toISOString().startsWith("2026-05-14"), "the commission carries the agreed delivery date");
    assert((await search("deliveryMonth=2026-05")).includes(converted.orderId), "and so it is in May's orders");
    console.log("ok db: quotation → commission delivery date");
  } finally {
    await prisma.orderAssignment.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.stageUpdate.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.orderStageCompletion.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.bespokeOrder.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
    await prisma.quotation.deleteMany({ where: { id: { in: quoteIds } } });
    await prisma.constructionFeature.deleteMany({ where: { id: { in: featureIds } } });
    const users = await prisma.user.findMany({ where: { email: { in: Object.values(emails) } }, select: { id: true } });
    await prisma.address.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });
    await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
    await prisma.$disconnect();
  }
}

async function main() {
  unit();
  if (process.env.ALLOW_FIXTURES === "true") await db();
  else console.log("skip database checks: set ALLOW_FIXTURES=true (dev database only)");
  console.log("OK test-slice-bc");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
