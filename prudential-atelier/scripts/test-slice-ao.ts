/**
 * Slice AO — confirming receipt must not punish her.
 *
 *   pnpm test:slice-ao
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  AlterationReason,
  BespokeStage,
  OrderStatus,
  Role,
  PaymentPurpose,
} from "@prisma/client";
import { evaluateStageGate, type StageGateSnapshot } from "../src/lib/atelier/can-complete-stage";
import { getStageRequirement } from "../src/lib/atelier/stage-requirements";
import { buildStageChecklistFacts, presentStageChecklist } from "../src/lib/atelier/stage-checklist";
import { confirmBespokeReceipt } from "../src/lib/bespoke-receipt";
import {
  isBespokeCommissionActive,
  maybeArchiveBespokeOrder,
} from "../src/lib/bespoke-archive";
import { createAlterationRequest } from "../src/lib/alterations/service";
import {
  loadPublicReceipt,
  publicReceiptOmitsClientRecord,
} from "../src/lib/public-receipt-payload";
import { balanceIsCleared, formatNgnKobo } from "../src/lib/money";
import { inferBespokePurpose } from "../src/lib/payments/ledger";
import { encodeBespokePaymentRef, parseBespokePaymentRef } from "../src/lib/bespoke-order-access";
import { generateBespokeOrderRef } from "../src/lib/bespoke-stages";
import { prisma } from "../src/lib/prisma";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

function snapshot(partial: Partial<StageGateSnapshot> & { currentStage: BespokeStage }): StageGateSnapshot {
  return {
    orderId: "ord_ao",
    orderRef: "ORD-AO",
    productionUnlockedAt: new Date(),
    completedStages: [
      BespokeStage.CONSULTATION_BOOKING,
      BespokeStage.CONSULTATION_SESSION,
      BespokeStage.INVOICE_ISSUANCE,
      BespokeStage.PAYMENT_CONFIRMATION,
      BespokeStage.SKETCHING_CONCEPT,
      BespokeStage.FABRIC_SOURCING,
      BespokeStage.DESIGN_APPROVAL,
      BespokeStage.TAILORING,
      BespokeStage.FIRST_FITTING,
      BespokeStage.ALTERATIONS,
      BespokeStage.BEADING_FINISHING,
      BespokeStage.FINAL_FITTING,
    ],
    notes: "ready",
    mediaCount: 1,
    latestApprovalStatus: null,
    balance: 0,
    requirement: getStageRequirement(partial.currentStage),
    ...partial,
  };
}

function runPure() {
  assert(balanceIsCleared(0.23), "₦0.23 residue is within the ₦1 balance tolerance");
  assert(!balanceIsCleared(2.77), "₦2.77 still outstanding — the gate is not loosened");
  assert(/0\.23/.test(formatNgnKobo(0.23)), `kobo display, got ${formatNgnKobo(0.23)}`);
  assert(formatNgnKobo(0.23) !== "₦0", "must not print a rounded zero for 23 kobo");

  const closedFacts = buildStageChecklistFacts({
    currentStage: BespokeStage.DELIVERY,
    completedStages: snapshot({ currentStage: BespokeStage.DELIVERY }).completedStages,
    draftNotes: "handover",
    mediaCount: 1,
    latestApprovalStatus: null,
    productionUnlockedAt: new Date(),
    balance: 2.77,
  });
  const closed = presentStageChecklist(closedFacts);
  const closedBalance = closed.find((r) => r.key === "balance")!;
  assert(closedBalance.met === false, "2.77 is not cleared");
  assert(/2\.77/.test(closedBalance.displayLabel), `gate closed must print kobo, got ${closedBalance.displayLabel}`);
  assert(!/outstanding \(₦0\)/i.test(closedBalance.displayLabel), "never print ₦0 while the gate is closed");

  const residueFacts = buildStageChecklistFacts({
    currentStage: BespokeStage.DELIVERY,
    completedStages: snapshot({ currentStage: BespokeStage.DELIVERY }).completedStages,
    draftNotes: "handover",
    mediaCount: 1,
    latestApprovalStatus: null,
    productionUnlockedAt: new Date(),
    balance: 0.23,
  });
  const residue = presentStageChecklist(residueFacts).find((r) => r.key === "balance")!;
  assert(residue.met === true, "0.23 residue reads as cleared — same rule as the deposit gate");
  assert(residue.displayLabel === "Balance cleared", `got ${residue.displayLabel}`);

  const staff = { id: "staff", role: Role.ADMIN };
  const withResidue = evaluateStageGate({
    snapshot: snapshot({ currentStage: BespokeStage.DELIVERY, balance: 0.23, mediaCount: 1, notes: "handover" }),
    stage: BespokeStage.DELIVERY,
    actor: staff,
  });
  assert(withResidue.ok, "converted commission with kobo residue can reach Delivery");

  const stillDue = evaluateStageGate({
    snapshot: snapshot({ currentStage: BespokeStage.DELIVERY, balance: 2_769_231.23, mediaCount: 1, notes: "handover" }),
    stage: BespokeStage.DELIVERY,
    actor: staff,
  });
  assert(!stillDue.ok, "a real remaining balance still blocks Delivery");
  assert(
    stillDue.failures.some((f) => f.message.includes("2,769,231.23") || f.message.includes("2769231.23")),
    `outstanding message prints kobo, got ${stillDue.failures.map((f) => f.message).join("; ")}`,
  );

  const purpose = inferBespokePurpose({
    amount: 2_769_231.23,
    balanceBefore: 2_769_231.23,
    depositRequired: 6_461_538.46,
    confirmedBefore: 6_461_538,
  });
  assert(purpose === PaymentPurpose.FULL, `paying the exact remainder is FULL, got ${purpose}`);

  const walkShaped = inferBespokePurpose({
    amount: 2_769_231,
    balanceBefore: 2_769_231.23,
    depositRequired: 6_461_538.46,
    confirmedBefore: 6_461_538,
  });
  assert(walkShaped === PaymentPurpose.BALANCE, `Paystack whole-naira remainder is BALANCE, got ${walkShaped}`);

  const balancePurpose = inferBespokePurpose({
    amount: 1_000_000,
    balanceBefore: 2_769_231.23,
    depositRequired: 6_461_538.46,
    confirmedBefore: 6_461_538,
  });
  assert(balancePurpose === PaymentPurpose.BALANCE, `post-deposit instalment is BALANCE, got ${balancePurpose}`);

  const encoded = encodeBespokePaymentRef("PA-REF", 2_769_231.23);
  const parsed = parseBespokePaymentRef(encoded);
  assert(parsed.amountNGN === 2_769_231.23, `charge ref persists kobo, got ${parsed.amountNGN}`);

  assert(
    isBespokeCommissionActive({
      status: OrderStatus.DELIVERED,
      receiptConfirmedAt: null,
      warrantyDays: 30,
    }),
    "delivered, unconfirmed is still active",
  );
  assert(
    isBespokeCommissionActive({
      status: OrderStatus.DELIVERED,
      receiptConfirmedAt: new Date(),
      warrantyDays: 30,
    }),
    "confirmed with window open is still active",
  );
  assert(
    !isBespokeCommissionActive({
      status: OrderStatus.DELIVERED,
      receiptConfirmedAt: new Date(Date.now() - 31 * 86_400_000),
      warrantyDays: 30,
    }),
    "window closed is no longer active",
  );
  assert(
    !isBespokeCommissionActive({
      status: OrderStatus.ARCHIVED,
      receiptConfirmedAt: new Date(),
      warrantyDays: 30,
    }),
    "archived is not active",
  );

  const client = readFileSync(resolve("src/components/admin/BespokeOrderDetailClient.tsx"), "utf8");
  assert(client.includes('order.status === "ARCHIVED"'), "admin detail treats ARCHIVED");
  assert(client.includes("This commission is archived and read-only"), "archived UI copy");
  const archivedBlock = client.slice(client.indexOf("This commission is archived and read-only"));
  const completeInArchived = archivedBlock.slice(0, archivedBlock.indexOf("Delivery complete"));
  assert(!completeInArchived.includes("Mark Stage Complete"), "archived branch does not offer Complete");

  const pipeline = readFileSync(resolve("src/components/admin/BespokePipelineClient.tsx"), "utf8");
  assert(pipeline.includes('order.status === "ARCHIVED"'), "pipeline checks ARCHIVED status");
  assert(pipeline.includes(">Archived<"), "pipeline labels Archived");

  const receiptRoute = readFileSync(resolve("src/app/api/receipt/[token]/confirm/route.ts"), "utf8");
  assert(receiptRoute.includes("confirmBespokeReceipt({ token, actor })"), "token POST works without requiring a session");
  assert(!receiptRoute.includes("loginRequired"), "public receipt POST does not bounce to login");

  const delivered = readFileSync(resolve("src/lib/admin-email-catalog.ts"), "utf8");
  assert(delivered.includes("Confirming receipt opens a {{warrantyDays}}-day window"), "delivery email names the window");
  assert(delivered.includes("The finishing touches are complete"), "beading copy is past tense");
  assert(delivered.includes("Final fitting complete — {{orderRef}}"), "final-fitting complete subject does not say approved");
}

async function runDb() {
  const email = `ao-token-${Date.now()}@example.com`;
  const user = await prisma.user.create({
    data: { email, name: "AO Client", role: Role.CUSTOMER, password: "x" },
  });
  const profile = await prisma.clientProfile.create({ data: { userId: user.id } });
  const order = await prisma.bespokeOrder.create({
    data: {
      orderRef: generateBespokeOrderRef(),
      clientProfileId: profile.id,
      clientName: "AO Client",
      clientEmail: email,
      currentStage: BespokeStage.DELIVERY,
      status: OrderStatus.DELIVERED,
      deliveredAt: new Date(),
      totalAmount: 9_230_769.23,
      amountPaid: 9_230_769,
      balance: 0.23,
    },
  });

  try {
    const payload = await loadPublicReceipt(order.receiptConfirmToken);
    assert(payload, "public receipt payload loads");
    assert(publicReceiptOmitsClientRecord(payload as unknown as Record<string, unknown>), "DTO omits client record");
    assert(!("clientName" in payload!), "no clientName on public receipt");
    assert(payload!.orderRef === order.orderRef, "orderRef present");

    const result = await confirmBespokeReceipt({ token: order.receiptConfirmToken });
    assert(result.orderRef === order.orderRef, "token confirm with no session");
    const after = await prisma.bespokeOrder.findUnique({ where: { id: order.id } });
    assert(after?.receiptConfirmedAt, "receipt confirmed");
    assert(after?.status === OrderStatus.DELIVERED, "confirming does not archive");
    assert(after?.receiptConfirmedById == null, "guest token confirm has no actor id");

    const alt = await createAlterationRequest({
      orderId: order.id,
      clientUserId: user.id,
      description: "The bodice sits a little high at the underarm.",
      reason: AlterationReason.FIT,
    });
    assert(alt.id, "alteration can be raised after receipt");

    await maybeArchiveBespokeOrder(order.id);
    const still = await prisma.bespokeOrder.findUnique({ where: { id: order.id } });
    assert(still?.status === OrderStatus.DELIVERED, "open window + request — not archived");

    await prisma.alterationRequest.update({
      where: { id: alt.id },
      data: { status: "COMPLETED", resolvedAt: new Date() },
    });
    await prisma.alterationRequest.delete({ where: { id: alt.id } });
  } finally {
    await prisma.alterationRequest.deleteMany({ where: { orderId: order.id } });
    await prisma.bespokeOrder.deleteMany({ where: { id: order.id } });
    await prisma.clientProfile.deleteMany({ where: { id: profile.id } });
    await prisma.user.deleteMany({ where: { id: user.id } });
  }
}

async function main() {
  runPure();
  await runDb();
  console.log("OK — slice AO");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
