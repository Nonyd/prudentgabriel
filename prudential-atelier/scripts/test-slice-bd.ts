/**
 * Slice BD: the client file as the house actually works (12 October meeting).
 *
 *   pnpm test:slice-bd                                          # unit (CI, no database)
 *   ALLOW_FIXTURES=true pnpm test:slice-bd                      # + database
 *   ALLOW_FIXTURES=true BASE_URL=http://localhost:3000 pnpm test:slice-bd   # + live HTTP
 *
 * What it proves, and the two cases the brief names:
 *   - BD4: who sees what a gown needs, what it costs, and its price — the table is
 *     computed from the access rule, not written by hand. Maju's grant reads the
 *     specification (200) and is refused the cost (403) on the same commission.
 *   - BD2: adding a note leaves the consultation record byte-identical, and the
 *     database refuses to edit or delete a note.
 *   - The client never sees cost: as her, no account API carries a cost figure.
 */
import "./preload-test-env";
import { OrderStatus, Role, StaffDepartment, type Prisma } from "@prisma/client";
import { encode } from "next-auth/jwt";
import type { Session } from "next-auth";
import { hasPermission, type AccessActor } from "../src/lib/roles";
import { bespokeAllows, bespokeView, type BespokeFacts } from "../src/lib/atelier/bespoke-access-rules";
import { canSeePaymentDetails, redactBespokeOrder } from "../src/lib/bespoke-data-access";
import { BESPOKE_ADMIN_ROLES, sessionHasRole } from "../src/lib/bespoke-roles";
import {
  carriedFromEnquiry,
  commissionTitle,
  isFabricPending,
  occasionPhrase,
  titleDate,
} from "../src/lib/atelier/commission-list";
import { parseNoteInput } from "../src/lib/atelier/commission-notes-shared";
import { materialView, parseMaterialInput } from "../src/lib/atelier/commission-materials";
import { commissionMeasurements, parseSnapshot, snapshotFrom } from "../src/lib/atelier/commission-measurements";
import { sheetLabourNGN } from "../src/lib/atelier/commission-cost";
import { lagosDay, parseWorkLogInput, promptDue } from "../src/lib/atelier/work-log";
import { cleanMeasurementInput } from "../src/lib/measurements";
import { sumTakings } from "../src/lib/finance/takings";
import { commissionDialogCopy } from "../src/lib/commission-cascade-copy";
import { clientFileAccess } from "../src/lib/client-file";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

/* ── BD4: facts the way bespokeFacts derives them, without a session ────────── */

type Person = { label: string; role: string; actor?: Partial<AccessActor>; assigned?: boolean };

function factsFor(p: Person): BespokeFacts {
  const actor = { email: null, grants: [], revokes: [], ...p.actor } as AccessActor;
  return {
    house: hasPermission(p.role, "bespoke", actor),
    money: canSeePaymentDetails({ role: p.role, email: null }),
    admin: sessionHasRole(p.role, null, BESPOKE_ADMIN_ROLES),
    assigned: Boolean(p.assigned),
    spec: hasPermission(p.role, "bespoke.specification", actor),
    store: hasPermission(p.role, "store", actor),
    cost: hasPermission(p.role, "production.cost", actor),
  };
}

const BD4_PEOPLE: Person[] = [
  { label: "Mrs. Prudent (ADMIN)", role: "ADMIN" },
  { label: "Deputy (STAFF_ADMIN)", role: "STAFF_ADMIN" },
  { label: "Maju (STAFF + beads grant)", role: "STAFF", actor: { grants: ["bespoke.specification"] }, assigned: true },
  { label: "Workroom, assigned (STAFF)", role: "STAFF", assigned: true },
  { label: "Store manager", role: "STORE_MANAGER" },
  { label: "The client (CUSTOMER)", role: "CUSTOMER" },
];

function bd4Table() {
  return BD4_PEOPLE.map((p) => {
    const f = factsFor(p);
    const v = bespokeView(f);
    return {
      who: p.label,
      "beads & fabric": bespokeAllows("spec", f) ? (v.specEdit ? "yes, edits" : "yes") : "no",
      "what they cost": v.labourCost ? "yes" : v.materialCost ? "store side" : "no",
      "price & balance": bespokeAllows("money", f) ? "yes" : "no",
    };
  });
}

function unit() {
  // ── BD4: the table, from the access rule ──
  const table = bd4Table();
  const row = (label: string) => table.find((r) => r.who === label)!;
  assert(row("Mrs. Prudent (ADMIN)")["what they cost"] === "yes", "Mrs. Prudent sees cost");
  assert(row("Mrs. Prudent (ADMIN)")["price & balance"] === "yes", "and the price");
  assert(row("Deputy (STAFF_ADMIN)")["what they cost"] === "yes", "deputies see cost");
  const maju = row("Maju (STAFF + beads grant)");
  assert(maju["beads & fabric"] === "yes, edits", "Maju reads and edits the specification");
  assert(maju["what they cost"] === "no" && maju["price & balance"] === "no", "Maju never sees cost or price");
  const workroom = row("Workroom, assigned (STAFF)");
  assert(workroom["beads & fabric"] === "yes", "the workroom reads her own job's specification");
  assert(workroom["what they cost"] === "no" && workroom["price & balance"] === "no", "the workroom sees no money");
  const store = row("Store manager");
  assert(store["beads & fabric"] === "yes" && store["what they cost"] === "store side", "the store: specification and its own side of cost");
  assert(store["price & balance"] === "no", "the store never sees the price");
  const client = row("The client (CUSTOMER)");
  assert(Object.values(client).slice(1).every((v) => v === "no"), "the client gets none of it from the atelier APIs");
  const unassignedStaff = factsFor({ label: "floor", role: "STAFF" });
  assert(!bespokeAllows("spec", unassignedStaff), "STAFF not on the gown are refused its specification");

  // Specification and cost are two gates on one row: Maju's view of a material has no cost keys at all.
  const row1 = {
    id: "m1", kind: "BEADS", name: "Crystal beads", quantity: "2 packs", notes: "bodice", images: [],
    storeMovementId: null, unitCost: 4500, totalCost: 9000, createdAt: new Date(),
  };
  const asMaju = materialView(row1, bespokeView(factsFor(BD4_PEOPLE[2]!)).materialCost);
  assert(!("unitCost" in asMaju) && !("totalCost" in asMaju), "no cost keys reach the specification-only viewer");
  assert(materialView(row1, true).totalCost === 9000, "the store side keeps the figure");
  const parsed = parseMaterialInput({ name: "Broken beads", kind: "BEADS", unitCost: 300 }, false);
  assert(parsed.ok && parsed.input.unitCost === null, "a cost sent by someone who may not set it is dropped");

  // ── BC leftover: the cached total, paid and balance go with money ──
  const order = {
    totalAmount: 1_500_000, amountPaid: 1_000_000, balance: 500_000,
    payments: [{}], paymentReceiptUrl: "https://x/receipt", paymentRef: "TR-1",
    quotation: { id: "q1", quoteRef: "QT-1", total: 1_500_000, lineItems: [{ amount: 1 }], status: "CONVERTED" },
    materials: [{ unitCost: 10, totalCost: 20 }],
    clientProfile: { measurements: { bust: 1 } },
  };
  const kemiView = redactBespokeOrder(order, { payments: false, measurements: false, materialCost: false });
  assert(kemiView.totalAmount === null && kemiView.amountPaid === null && kemiView.balance === null, "no cached money without the money gate");
  const quote = kemiView.quotation as Record<string, unknown> | null;
  assert(quote && !("total" in quote) && !("lineItems" in quote) && quote.quoteRef === "QT-1", "the quotation keeps its reference, not its figures");
  assert(kemiView.materials![0]!.totalCost === null, "material cost hidden");
  assert(kemiView.balanceCleared === false, "she is told only that a balance is outstanding");
  const moneyView = redactBespokeOrder(order, { payments: true, measurements: true, materialCost: true });
  assert(moneyView.balance === 500_000 && moneyView.materials![0]!.totalCost === 20, "money and cost roles keep the figures");

  // ── BD1: the title ──
  const t = commissionTitle({
    clientName: "Mrs. Prudent", occasionType: "Birthday dress", occasionDetails: "60th birthday outfit",
    deliveryDate: new Date("2026-11-25T10:00:00Z"), title: null,
  });
  assert(t.text === "Mrs. Prudent — 60th birthday outfit — 25 November", `title composes as she said it (got "${t.text}")`);
  assert(!t.override && !t.partial, "composed, not overridden");
  assert(occasionPhrase({ occasionType: "Bride", occasionDetails: "Bride" }) === "Bridal", "a duplicate of the label reads as the label");
  assert(occasionPhrase({ occasionType: "Other", occasionDetails: null }) === null, "'Other' with no words is no occasion");
  const partial = commissionTitle({ clientName: "Ada", occasionType: null, occasionDetails: null, deliveryDate: null, title: null });
  assert(partial.text === "Ada" && partial.partial, "no occasion: the house is prompted to add one");
  assert(commissionTitle({ clientName: "Ada", occasionType: "Prom", occasionDetails: null, deliveryDate: null, title: "  Ada's prom gown " }).text === "Ada's prom gown", "the house's own title wins, trimmed");
  assert(titleDate(new Date("2026-11-24T23:30:00Z")) === "25 November", "the date is Lagos's, not UTC's");
  const carried = carriedFromEnquiry({
    eventDate: new Date("2026-12-01"), eventLocation: " Ikoyi ", occasionDetails: "", presentCity: "Lekki", presentState: "", presentCountry: "Nigeria",
  });
  assert(carried.clientLocation === "Lekki, Nigeria" && carried.eventLocation === "Ikoyi" && carried.occasionDetails === null, "convert carries the enquiry's places, trimmed");

  // ── BD5: fabric not passed, from the stage engine ──
  assert(isFabricPending({ status: OrderStatus.PENDING, currentStage: "SKETCHING_CONCEPT", liveStages: [] }), "before fabric: pending");
  assert(isFabricPending({ status: OrderStatus.PENDING, currentStage: "FABRIC_SOURCING", liveStages: ["SKETCHING_CONCEPT"] }), "at fabric, not complete: pending");
  assert(!isFabricPending({ status: OrderStatus.PENDING, currentStage: "FABRIC_SOURCING", liveStages: ["FABRIC_SOURCING"] }), "fabric completed: not pending");
  assert(!isFabricPending({ status: OrderStatus.PENDING, currentStage: "TAILORING", liveStages: [] }), "past fabric: not pending");
  assert(!isFabricPending({ status: OrderStatus.DELIVERED, currentStage: "SKETCHING_CONCEPT", liveStages: [] }), "closed: not pending");

  // ── BD2: a note is a row, validated ──
  assert(!parseNoteInput({ section: "brief", body: "   " }).ok, "an empty note is refused");
  assert(!parseNoteInput({ section: "gossip", body: "x" }).ok, "an unknown section is refused");
  const ok = parseNoteInput({ section: "brief", body: " Sleeves to the wrist ", supersedesId: "n1" });
  assert(ok.ok && ok.note.body === "Sleeves to the wrist" && ok.note.supersedesId === "n1", "a correction names what it corrects");

  // ── BD6: measurements per commission ──
  const latest = { bust: 36, waist: 30, hips: null, unit: "inches", notes: null, values: { underbust: 80 }, updatedAt: new Date("2024-05-01") };
  const fromClient = commissionMeasurements({ measurementsSnapshot: null, measurementsTakenAt: null }, latest);
  assert(fromClient.source === "client" && fromClient.takenAt?.startsWith("2024-05-01"), "no set for this gown: her latest, dated");
  const snap = snapshotFrom(latest);
  assert(snap.bust === 36 && snap.values?.underbust === 80 && !("updatedAt" in snap), "a snapshot is the set, not the row");
  const own = commissionMeasurements({ measurementsSnapshot: { ...snap, bust: 38 } as Prisma.JsonValue, measurementsTakenAt: new Date("2026-10-12") }, latest);
  assert(own.source === "commission" && own.data?.bust === 38, "this gown's own set wins over her latest");
  assert(parseSnapshot("nonsense" as unknown as Prisma.JsonValue) === null, "a malformed snapshot is no snapshot");
  assert(!cleanMeasurementInput({ bust: 24, waist: 32, unit: "inches" }).ok, "implausible sets are refused, as on her profile");

  // ── BD4: labour is one source ──
  assert(sheetLabourNGN({ tailorCostNGN: 50_000, labour: [] }) === 50_000, "a sheet from before BD: its tailor figure");
  assert(sheetLabourNGN({ tailorCostNGN: 0, labour: [{ amountNGN: 30_000 }, { amountNGN: 25_000 }] }) === 55_000, "with lines: their sum");

  // ── BD7: end of day ──
  assert(lagosDay(new Date("2026-10-12T23:30:00Z")).toISOString().startsWith("2026-10-13"), "23:30 UTC is already tomorrow in Lagos");
  assert(promptDue(new Date("2026-10-12T15:10:00Z"), 16), "16:10 Lagos: the portal asks");
  assert(!promptDue(new Date("2026-10-12T14:10:00Z"), 16), "15:10 Lagos: not yet");
  assert(!parseWorkLogInput({ assignmentId: "a", done: "", progress: 50 }).ok, "an empty day is refused");
  assert(!parseWorkLogInput({ assignmentId: "a", done: "x", progress: 140 }).ok, "progress is 0–100");

  // ── Revenue is confirmed cash by line, nothing else ──
  const t0 = sumTakings([
    { cashNGN: 100, businessLine: "RTW", atelierKind: null },
    { cashNGN: 300, businessLine: "ATELIER", atelierKind: "commission" },
    { cashNGN: 50, businessLine: "ATELIER", atelierKind: "consultation" },
    { cashNGN: 0, businessLine: "ATELIER", atelierKind: "commission" },
  ]);
  assert(t0.totalNGN === 450 && t0.rtwNGN === 100 && t0.commissionNGN === 300 && t0.consultationNGN === 50, "takings split by line");

  // ── Deleting a commission with notes: counted in the warning, typed DELETE asked ──
  const preview = {
    orderRef: "ORD-1", clientName: "Ada", payments: [], receivedNGN: 0, superAdminOnly: false, blocked: false, blockReason: null,
    counts: { notes: 3, materials: 1, workLogs: 0, costSheets: 0, stageRecords: 4, payments: 0 }, loud: true,
  };
  const copy = commissionDialogCopy(preview);
  assert(copy.loud && copy.lines.some((l) => l.includes("3 notes")), "the warning counts the notes and asks for DELETE");
  const blockedCopy = commissionDialogCopy({ ...preview, blocked: true, blockReason: "ORD-1 has 2 store movements in the store book." });
  assert(blockedCopy.blocked && blockedCopy.heading.includes("store movements"), "store movements refuse, with the reason");

  // ── BD3: the client file's new sections keep the money and cost gates ──
  const v = (role: string, extra: Partial<Parameters<typeof clientFileAccess>[0]> = {}) =>
    clientFileAccess({
      userId: "u", role, email: null, assignments: [],
      allows: (p) => hasPermission(role, p, { email: null, grants: [], revokes: [] } as unknown as AccessActor),
      ...extra,
    });
  const tailor = v("STAFF", { assignments: [{ orderId: "o", role: "TAILOR" }] });
  assert(tailor.sections.beads && tailor.sections.fitting && tailor.sections.brief, "the workroom sees beads, fitting and the brief");
  assert(!tailor.sections.cost && !tailor.sections.balance && !tailor.sections.invoice, "and no cost, balance or invoice");
  assert(v("ADMIN").sections.cost && v("ADMIN").sections.invoice, "Mrs. Prudent sees cost and invoices");

  console.log("\nBD4 — who sees what a gown needs, what it costs, and its price (from bespoke-access-rules):");
  console.table(table);
  console.log("ok unit");
}

/* ── Database ──────────────────────────────────────────────────────────────── */

async function fixture() {
  const { assertFixturesAllowed } = await import("./fixture-guard");
  assertFixturesAllowed("test-slice-bd");
  const { prisma } = await import("../src/lib/prisma");
  const stamp = `bd-${Date.now()}`;
  const mkUser = (tag: string, role: Role, isStaff = false) =>
    prisma.user.create({ data: { email: `${stamp}-${tag}@example.test`, name: `BD ${tag}`, role, isStaff, password: "x" } });

  const clientUser = await mkUser("client", Role.CUSTOMER);
  const client = await prisma.clientProfile.create({ data: { userId: clientUser.id } });
  await prisma.measurement.create({ data: { clientId: client.id, bust: 88.8, unit: "cm" } });

  // A consultation for the BD2 check, on whatever offering and consultant the database already has.
  const offering = await prisma.consultantOffering.findFirst({ select: { id: true, consultantId: true } });
  const booking = offering
    ? await prisma.consultationBooking.create({
        data: {
          bookingNumber: `BD-${stamp}`,
          offeringId: offering.id,
          consultantId: offering.consultantId,
          userId: clientUser.id,
          clientName: "BD client",
          clientEmail: clientUser.email,
          clientPhone: "+2348000000000",
          clientCountry: "NG",
          occasion: "Birthday dress",
          description: "A flowing train.",
          referenceImages: ["https://example.test/ref.jpg"],
          sessionNotes: "Sleeves to the elbow. Low back.",
          moodboardImages: ["https://example.test/mood.jpg"],
          feeNGN: 0,
          status: "COMPLETED",
          completedAt: new Date(),
        },
      })
    : null;

  const order = await prisma.bespokeOrder.create({
    data: {
      orderRef: `BD-${stamp}`,
      clientProfileId: client.id,
      consultationId: booking?.id ?? null,
      clientName: "BD client",
      clientEmail: clientUser.email,
      occasionType: "Birthday dress",
      currentStage: "SKETCHING_CONCEPT",
      totalAmount: 1_234_567,
      balance: 1_234_567,
      outfitBrief: "Brief as agreed.",
    },
  });
  await prisma.material.create({ data: { orderId: order.id, kind: "BEADS", name: "Crystal beads", quantity: "3 packs", unitCost: 43_210, totalCost: 43_210 } });

  const tailorUser = await mkUser("tailor", Role.STAFF, true);
  const tailor = await prisma.staffProfile.create({ data: { userId: tailorUser.id, department: StaffDepartment.TAILOR } });
  const assignment = await prisma.orderAssignment.create({ data: { orderId: order.id, staffProfileId: tailor.id, role: "TAILOR" } });

  const majuUser = await mkUser("maju", Role.STAFF, true);
  await prisma.userPermission.create({ data: { userId: majuUser.id, permission: "bespoke.specification", mode: "GRANT" } });
  const admin = await mkUser("admin", Role.ADMIN);

  const sheet = await prisma.costOfProduction.create({
    data: {
      bespokeOrderId: order.id,
      tailorCostNGN: 98_765,
      draftedById: admin.id,
      status: "APPROVED",
      labour: { create: [{ assignmentId: assignment.id, role: "TAILOR", amountNGN: 98_765 }] },
    },
  });

  const cleanup = async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT set_config('app.ledger_bypass', 'on', true)`);
      await tx.commissionNote.deleteMany({ where: { OR: [{ orderId: order.id }, ...(booking ? [{ consultationId: booking.id }] : [])] } });
      await tx.payment.deleteMany({ where: { bespokeOrderId: order.id } });
    });
    await prisma.costOfProduction.deleteMany({ where: { id: sheet.id } });
    await prisma.workLog.deleteMany({ where: { orderId: order.id } });
    await prisma.orderAssignment.deleteMany({ where: { orderId: order.id } });
    await prisma.material.deleteMany({ where: { orderId: order.id } });
    await prisma.orderStageCompletion.deleteMany({ where: { orderId: order.id } });
    await prisma.bespokeOrder.deleteMany({ where: { id: order.id } });
    if (booking) await prisma.consultationBooking.deleteMany({ where: { id: booking.id } });
    const users = await prisma.user.findMany({ where: { email: { startsWith: `${stamp}-` } }, select: { id: true } });
    const entities = [order.id, ...(booking ? [booking.id] : [])];
    await prisma.adminNotification.deleteMany({ where: { entityId: { in: entities } } });
    await prisma.staffNotification.deleteMany({ where: { entityId: { in: entities } } });
    await prisma.userPermission.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });
    await prisma.staffProfile.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });
    await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
  };
  return { prisma, client, clientUser, booking, order, assignment, tailor, tailorUser, majuUser, admin, cleanup };
}

type Fixture = Awaited<ReturnType<typeof fixture>>;

async function db(fx: Fixture) {
  const { prisma } = fx;
  const { bespokeFacts } = await import("../src/lib/atelier/bespoke-access");
  const { addNote, listCommissionNotes } = await import("../src/lib/atelier/commission-notes");
  const { fabricPendingWhere } = await import("../src/lib/atelier/commission-list");
  const { fileWorkLog, workroomDay } = await import("../src/lib/atelier/work-log");
  const { commissionCost } = await import("../src/lib/atelier/commission-cost");

  const session = (u: { id: string; email: string; role: Role }) =>
    ({ user: { id: u.id, email: u.email, role: u.role }, expires: "" }) as unknown as Session;

  // ── Maju's facts on the real session path ──
  const maju = await bespokeFacts(session(fx.majuUser), { orderId: fx.order.id });
  assert(bespokeAllows("spec", maju.facts) && bespokeAllows("specEdit", maju.facts), "Maju's grant: specification, read and edit");
  assert(!bespokeAllows("storeCost", maju.facts) && !bespokeAllows("cost", maju.facts), "Maju's grant: no cost");

  // ── BD2: the consultation record is byte-identical after a note ──
  if (fx.booking) {
    const before = JSON.stringify(await prisma.consultationBooking.findUniqueOrThrow({ where: { id: fx.booking.id } }));
    const orderBefore = JSON.stringify(
      await prisma.bespokeOrder.findUniqueOrThrow({ where: { id: fx.order.id }, select: { outfitBrief: true, sessionNotes: true, moodboardImages: true } }),
    );
    const author = { id: fx.admin.id, name: "BD admin", email: fx.admin.email };
    const a = await addNote({ consultationId: fx.booking.id }, { section: "consultation", body: "13-minute call: wants long sleeves after all.", supersedesId: null }, author);
    assert(a.ok, "a note lands on the consultation");
    const b = await addNote({ orderId: fx.order.id }, { section: "brief", body: "Sleeves to the wrist.", supersedesId: null }, author);
    assert(b.ok, "a note lands on the brief");
    const after = JSON.stringify(await prisma.consultationBooking.findUniqueOrThrow({ where: { id: fx.booking.id } }));
    assert(after === before, "the consultation record is byte-identical after the note");
    const orderAfter = JSON.stringify(
      await prisma.bespokeOrder.findUniqueOrThrow({ where: { id: fx.order.id }, select: { outfitBrief: true, sessionNotes: true, moodboardImages: true } }),
    );
    assert(orderAfter === orderBefore, "the brief, session notes and moodboard on the commission are untouched");

    // Corrections are rows; both stay; a note is corrected once.
    const fix = await addNote({ orderId: fx.order.id }, { section: "brief", body: "Sleeves to the elbow.", supersedesId: b.ok ? b.note.id : null }, author);
    assert(fix.ok, "a correction is a new note");
    const again = await addNote({ orderId: fx.order.id }, { section: "brief", body: "x", supersedesId: b.ok ? b.note.id : null }, author);
    assert(!again.ok && again.status === 409, "a note already corrected cannot be corrected again");
    const stream = await listCommissionNotes(fx.order.id);
    assert(stream.length === 3, `the commission shows its notes and the consultation's (got ${stream.length})`);
    assert(stream.find((n) => n.id === (b.ok && b.note.id))?.correctedById, "the original stays, marked corrected");

    // The database refuses an edit or a delete.
    let refused = 0;
    await prisma.commissionNote.update({ where: { id: b.ok ? b.note.id : "" }, data: { body: "rewritten" } }).catch(() => refused++);
    await prisma.commissionNote.delete({ where: { id: b.ok ? b.note.id : "" } }).catch(() => refused++);
    assert(refused === 2, "UPDATE and DELETE on a note are refused by the trigger");
  } else {
    console.log("skip BD2 byte-identical check: no consultation offering in this database");
  }

  // ── BD5 ──
  const pendingIds = async () => (await prisma.bespokeOrder.findMany({ where: { AND: [fabricPendingWhere(), { id: fx.order.id }] }, select: { id: true } })).length;
  assert((await pendingIds()) === 1, "a commission before fabric sourcing is in the fabric filter");
  await prisma.orderStageCompletion.create({ data: { orderId: fx.order.id, stage: "FABRIC_SOURCING", completedById: fx.admin.id } });
  assert((await pendingIds()) === 0, "completing fabric sourcing takes it out");

  // ── BD4: cost as each audience gets it ──
  const full = await commissionCost(fx.order.id, { money: true, materialCost: true, labourCost: true });
  assert(full?.costOfProductionNGN === 98_765 + 43_210, "cost of production = labour + materials");
  assert(full?.marginNGN === 1_234_567 - (98_765 + 43_210), "shown against the agreed price");
  const storeSide = await commissionCost(fx.order.id, { money: false, materialCost: true, labourCost: false });
  assert(storeSide && storeSide.costOfProductionNGN === undefined && !storeSide.sheet?.labour, "the store side carries no labour or total");
  assert((await commissionCost(fx.order.id, { money: false, materialCost: false, labourCost: false })) === null, "no cost gate, nothing");

  // ── Revenue: a commission paid in the past, touched today, adds nothing today; a payment today adds itself ──
  const { takings } = await import("../src/lib/finance/takings");
  const { financeRange } = await import("../src/lib/finance/period");
  const today = financeRange("day", new Date());
  const augustAt = new Date(today.from.getTime() - 60 * 86400000);
  await prisma.payment.create({
    data: { reference: `BD-OLD-${fx.order.id}`, amount: 5_000_000, method: "MANUAL", status: "CONFIRMED", purpose: "DEPOSIT", bespokeOrderId: fx.order.id, clientId: fx.client.id, confirmedAt: augustAt },
  });
  await prisma.bespokeOrder.update({ where: { id: fx.order.id }, data: { amountPaid: 5_000_000 } });
  const before = (await takings(today.from, today.to)).totalNGN;
  await prisma.bespokeOrder.update({ where: { id: fx.order.id }, data: { notes: "touched today" } });
  assert((await takings(today.from, today.to)).totalNGN === before, "a commission paid two months ago, touched today, adds nothing to today");
  await prisma.payment.create({
    data: { reference: `BD-TODAY-${fx.order.id}`, amount: 7_777, method: "MANUAL", status: "CONFIRMED", purpose: "BALANCE", bespokeOrderId: fx.order.id, clientId: fx.client.id, confirmedAt: new Date() },
  });
  const after = (await takings(today.from, today.to)).totalNGN;
  assert(Math.round((after - before) * 100) === 777_700, `a payment confirmed today adds exactly itself (added ${after - before})`);

  // ── A commission with notes can be deleted: counted, confirmed, logged without the words ──
  {
    const { executeCommissionCascade, previewCommissionCascade } = await import("../src/lib/commission-cascade-delete");
    const doomed = await prisma.bespokeOrder.create({
      data: { orderRef: `BD-DEL-${Date.now()}`, clientProfileId: fx.client.id, clientName: "BD client", clientEmail: fx.clientUser.email },
    });
    const secret = "private call summary do-not-log";
    await addNote({ orderId: doomed.id }, { section: "brief", body: secret, supersedesId: null }, { id: fx.admin.id, name: "BD", email: null });
    const p = await previewCommissionCascade(doomed.id);
    assert(p.counts.notes === 1 && p.loud && !p.blocked, "the preview counts the note");
    const actor = { userId: fx.admin.id, email: null, role: "ADMIN", ip: null };
    let refused = false;
    await executeCommissionCascade({ orderId: doomed.id, actor }).catch(() => (refused = true));
    assert(refused, "without the typed DELETE nothing happens");
    const done = await executeCommissionCascade({ orderId: doomed.id, actor, confirmation: "DELETE" });
    assert(!(await prisma.bespokeOrder.findUnique({ where: { id: doomed.id } })), "the commission with a note is deleted");
    assert((await prisma.commissionNote.count({ where: { orderId: doomed.id } })) === 0, "its notes went with it");
    const log = await prisma.activityLog.findUniqueOrThrow({ where: { id: done.logId } });
    assert(JSON.stringify(log).includes('"notes":1') && !JSON.stringify(log).includes(secret), "the log keeps the count, never the note");
    await prisma.activityLog.delete({ where: { id: done.logId } }).catch(() => undefined);
    await prisma.adminNotification.deleteMany({ where: { entityId: doomed.id } });
  }

  // ── BD7: completedAt is finally written ──
  const filed = await fileWorkLog(fx.tailor.id, { assignmentId: fx.assignment.id, done: "Cut the bodice.", progress: 60, blocker: null, images: [], partDone: true });
  assert(filed.ok, "the tailor files her day");
  const a = await prisma.orderAssignment.findUniqueOrThrow({ where: { id: fx.assignment.id } });
  assert(a.completedAt, "her part done writes OrderAssignment.completedAt");
  const day = await workroomDay();
  assert(day.entries.some((e) => e.orderRef === fx.order.orderRef && e.partDone), "the daily report carries the entry");
  const other = await fileWorkLog(fx.tailor.id, { assignmentId: "not-hers", done: "x", progress: 1, blocker: null, images: [], partDone: false });
  assert(!other.ok, "nobody files against an assignment that is not theirs");

  console.log("ok db");
}

/* ── Live HTTP: the 200/403 the brief names, and the client's own APIs ──────── */

async function live(base: string, fx: Fixture) {
  const host = new URL(base).hostname;
  assert(host === "localhost" || host === "127.0.0.1", "live checks run against localhost only");
  const secure = base.startsWith("https://");
  const cookie = async (u: { id: string; email: string; role: Role }) => {
    const name = secure ? "__Secure-authjs.session-token" : "authjs.session-token";
    const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
    assert(secret, "AUTH_SECRET is set for the local server");
    const token = await encode({
      token: { id: u.id, sub: u.id, email: u.email, role: u.role, iat: Math.floor(Date.now() / 1000) },
      secret,
      salt: name,
    });
    return `${name}=${token}`;
  };
  const call = async (path: string, u: { id: string; email: string; role: Role }) => {
    const res = await fetch(base + path, { headers: { cookie: await cookie(u) }, redirect: "manual" });
    return { status: res.status, body: res.status === 200 ? await res.text() : "" };
  };

  // Maju: the specification (200), not the cost (403), on the same commission.
  let r = await call(`/api/bespoke/${fx.order.id}/materials`, fx.majuUser);
  assert(r.status === 200, `Maju reads the specification → 200 (got ${r.status})`);
  assert(r.body.includes("Crystal beads") && !r.body.includes("43210"), "she sees the beads, not their cost");
  r = await call(`/api/bespoke/${fx.order.id}/cost`, fx.majuUser);
  assert(r.status === 403, `Maju asks for the cost → 403 (got ${r.status})`);

  // As the client (the session "View as client" gives an admin): no cost figure in any account API.
  const her = { id: fx.clientUser.id, email: fx.clientUser.email, role: Role.CUSTOMER };
  for (const path of ["/api/account", "/api/account/bespoke", `/api/account/bespoke/${fx.order.id}`, "/api/account/orders", "/api/account/measurements"]) {
    const res = await call(path, her);
    assert(!res.body.includes("98765") && !res.body.includes("43210"), `${path} carries no cost figure`);
  }
  r = await call(`/api/bespoke/${fx.order.id}/cost`, her);
  assert(r.status === 403, `the client asks for the cost directly → 403 (got ${r.status})`);
  r = await call(`/api/bespoke/${fx.order.id}/materials`, her);
  assert(r.status === 403, `the client asks for the materials → 403 (got ${r.status})`);
  console.log("ok live");
}

async function main() {
  unit();
  if (process.env.ALLOW_FIXTURES !== "true") {
    console.log("skip database and live checks: set ALLOW_FIXTURES=true (and BASE_URL for live)");
    console.log("OK test-slice-bd");
    return;
  }
  const fx = await fixture();
  try {
    await db(fx);
    const base = process.env.BASE_URL?.replace(/\/$/, "");
    if (base) await live(base, fx);
    else console.log("skip live checks: set BASE_URL=http://localhost:3000");
  } finally {
    await fx.cleanup();
    await fx.prisma.$disconnect();
  }
  console.log("OK test-slice-bd");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
