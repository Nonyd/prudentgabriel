/**
 * One commission walked to delivery on its own steps (needs a database):
 * Fabric moved before Sketching, Beading skipped, a "Second fitting" added after
 * Alterations, and Fabric run alongside Sketching once the deposit is in.
 *
 *   ALLOW_FIXTURES=true pnpm tsx --tsconfig tsconfig.scripts.json --import ./scripts/test-db-guard.ts scripts/test-pipeline-walk.ts
 */
import {
  BespokeStage,
  OrderStageStatus,
  OrderStatus,
  PaymentMethod,
  PaymentPurpose,
  PaymentStatus,
  Role,
} from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { hasPermission } from "../src/lib/roles";
import { bespokeAllows } from "../src/lib/atelier/bespoke-access-rules";
import { newOrderSteps, loadSteps } from "../src/lib/atelier/pipeline-db";
import { stepLabel, stepProgress, stepRequirement } from "../src/lib/atelier/pipeline";
import { editOrderSteps } from "../src/lib/atelier/pipeline-actions";
import {
  addStageMedia,
  completeOrderStage,
  requestStageApproval,
  revertOrderStage,
  saveStageDraft,
} from "../src/lib/atelier/stage-actions";
import { appendPayment } from "../src/lib/payments/ledger";
import { assertFixturesAllowed } from "./fixture-guard";

assertFixturesAllowed("scripts/test-pipeline-walk.ts");

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

async function main() {
  // Who may change the steps: Admins and atelier managers, not staff, not by `bespoke` alone.
  assert(hasPermission(Role.ADMIN, "bespoke.pipeline"), "ADMIN holds bespoke.pipeline");
  assert(hasPermission(Role.BESPOKE_MANAGER, "bespoke.pipeline"), "BESPOKE_MANAGER holds bespoke.pipeline");
  assert(!hasPermission(Role.STAFF, "bespoke.pipeline"), "STAFF does not");
  assert(!hasPermission(Role.STAFF_ADMIN, "bespoke.pipeline"), "`bespoke` alone does not grant it");
  assert(
    !bespokeAllows("pipeline", { house: false, money: false, admin: false, assigned: true, pipeline: false }),
    "assigned staff cannot reach the steps route",
  );

  const adminUser =
    (await prisma.user.findFirst({ where: { role: Role.ADMIN } })) ??
    (await prisma.user.findFirst({ where: { role: Role.SUPER_ADMIN } }));
  assert(adminUser, "need an ADMIN or SUPER_ADMIN user");
  const staffUser = await prisma.user.findFirst({ where: { role: Role.STAFF } });
  assert(staffUser, "need a STAFF user");
  const admin = { id: adminUser.id, role: Role.ADMIN, email: adminUser.email, name: adminUser.name };
  const manager = { id: adminUser.id, email: adminUser.email, role: Role.BESPOKE_MANAGER };
  const staff = { id: staffUser.id, role: Role.STAFF, email: staffUser.email, name: staffUser.name };

  const order = await prisma.bespokeOrder.create({
    data: {
      orderRef: `FLEX-${Date.now().toString(36).toUpperCase()}`,
      clientName: "Flex Walk Client",
      clientEmail: `flex+${Date.now()}@example.test`,
      totalAmount: 500_000,
      balance: 500_000,
      currentStage: BespokeStage.CONSULTATION_BOOKING,
      steps: { create: newOrderSteps(BespokeStage.CONSULTATION_BOOKING) },
    },
  });
  const pay = (amount: number, purpose: PaymentPurpose) =>
    appendPayment({
      reference: `FLEX-${purpose}-${order.id}-${Date.now()}`,
      amount,
      method: PaymentMethod.MANUAL,
      status: PaymentStatus.CONFIRMED,
      purpose,
      bespokeOrderId: order.id,
      clientId: `email:${order.clientEmail.toLowerCase()}`,
      confirmedById: admin.id,
      confirmedAt: new Date(),
    });
  const steps = () => loadSteps(prisma, order.id);
  const idOf = async (stage: BespokeStage, label?: string) =>
    (await steps()).find((s) => s.stage === stage && (!label || s.label === label))!.id;
  const statusOf = async (id: string) => (await steps()).find((s) => s.id === id)!.status;
  const lead = async () => (await prisma.bespokeOrder.findUniqueOrThrow({ where: { id: order.id } })).currentStage;
  const edit = (e: Parameters<typeof editOrderSteps>[0]["edit"]) => editOrderSteps({ orderId: order.id, edit: e, actor: manager });

  async function complete(orderStageId: string) {
    const step = (await steps()).find((s) => s.id === orderStageId)!;
    const req = stepRequirement(step);
    await saveStageDraft({ orderId: order.id, step, notes: `${stepLabel(step)} notes`, actorId: staff.id });
    if (req.requiresMedia) {
      await addStageMedia({
        orderId: order.id,
        step,
        urls: Array.from({ length: req.minMediaCount }, (_, i) => `https://example.test/${step.id}-${i}.jpg`),
        uploadedById: staff.id,
      });
    }
    if (req.requiresClientApproval) {
      const asked = await requestStageApproval({ orderId: order.id, orderStageId, actor: staff });
      assert(asked.ok, `approval requested for ${stepLabel(step)}`);
      if (asked.ok) {
        await prisma.stageApproval.update({ where: { id: asked.approvalId }, data: { status: "APPROVED", respondedAt: new Date() } });
      }
    }
    const done = await completeOrderStage({ orderId: order.id, orderStageId, actor: staff });
    assert(done.ok, `complete ${stepLabel(step)}: ${!done.ok ? done.failures.map((f) => f.message).join("; ") : ""}`);
    console.log(`  ok ${stepLabel(step)}`);
  }

  try {
    for (const stage of [
      BespokeStage.CONSULTATION_BOOKING,
      BespokeStage.CONSULTATION_SESSION,
      BespokeStage.INVOICE_ISSUANCE,
      BespokeStage.PAYMENT_CONFIRMATION,
    ]) {
      await complete(await idOf(stage));
    }
    assert((await lead()) === BespokeStage.SKETCHING_CONCEPT, "after intake, Sketching is under way");

    // Move Fabric before Sketching; intake and Delivery do not move; Tailoring stays after Design Approval.
    const fabric = await idOf(BespokeStage.FABRIC_SOURCING);
    assert((await edit({ action: "move", stepId: fabric, direction: "up" })).ok, "fabric moves up");
    assert(
      (await steps()).findIndex((s) => s.id === fabric) < (await steps()).findIndex((s) => s.stage === BespokeStage.SKETCHING_CONCEPT),
      "fabric is now before sketching",
    );
    assert(!(await edit({ action: "move", stepId: await idOf(BespokeStage.DELIVERY), direction: "up" })).ok, "delivery stays last");
    assert(!(await edit({ action: "move", stepId: await idOf(BespokeStage.TAILORING), direction: "up" })).ok, "tailoring stays after design approval");

    // Skip Beading; Design Approval cannot be skipped.
    assert((await edit({ action: "skip", stepId: await idOf(BespokeStage.BEADING_FINISHING), reason: "No beading on this dress" })).ok, "beading skipped");
    assert(!(await edit({ action: "skip", stepId: await idOf(BespokeStage.DESIGN_APPROVAL), reason: "x x x" })).ok, "design approval is not skippable");

    // Add a second fitting after Alterations.
    const added = await edit({ action: "add", afterStepId: await idOf(BespokeStage.ALTERATIONS), label: "Second fitting", minMediaCount: 1 });
    assert(added.ok, "second fitting added");
    const second = await idOf(BespokeStage.CUSTOM, "Second fitting");
    const order1 = await steps();
    assert(order1[order1.findIndex((s) => s.stage === BespokeStage.ALTERATIONS) + 1]?.id === second, "it sits after alterations");
    assert(stepProgress(order1).total === 13, "13 steps: 14 less the skipped one");

    // Side by side: refused before the deposit, allowed after.
    const early = await edit({ action: "start", stepId: fabric });
    assert(!early.ok && early.failures.some((f) => f.code === "DEPOSIT_NOT_SATISFIED"), "start alongside needs the deposit");
    await pay(350_000, PaymentPurpose.DEPOSIT);
    assert((await edit({ action: "start", stepId: fabric })).ok, "fabric starts alongside sketching");
    assert((await steps()).filter((s) => s.status === OrderStageStatus.ACTIVE).length === 2, "two steps under way");
    const cut = await edit({ action: "start", stepId: await idOf(BespokeStage.TAILORING) });
    assert(!cut.ok && cut.failures.some((f) => f.code === "DESIGN_APPROVAL_FIRST"), "nothing is cut before design approval");

    // Fabric first: Sketching keeps running, nothing new starts.
    await complete(fabric);
    assert((await lead()) === BespokeStage.SKETCHING_CONCEPT, "sketching still under way");
    assert((await statusOf(await idOf(BespokeStage.DESIGN_APPROVAL))) === OrderStageStatus.PENDING, "design approval waits for sketching");
    await complete(await idOf(BespokeStage.SKETCHING_CONCEPT));
    assert((await lead()) === BespokeStage.DESIGN_APPROVAL, "then design approval");

    for (const stage of [BespokeStage.DESIGN_APPROVAL, BespokeStage.TAILORING, BespokeStage.FIRST_FITTING, BespokeStage.ALTERATIONS]) {
      await complete(await idOf(stage));
    }
    assert((await statusOf(second)) === OrderStageStatus.ACTIVE, "the added step follows alterations");
    assert((await lead()) === BespokeStage.CUSTOM, "lead is the custom step");
    await complete(second);
    assert((await lead()) === BespokeStage.FINAL_FITTING, "skipped beading is passed over");

    // Reopen Tailoring while Final Fitting runs: only Tailoring reopens, and the steps
    // done after it keep their completions.
    const tailoring = await idOf(BespokeStage.TAILORING);
    assert((await revertOrderStage({ orderId: order.id, orderStageId: tailoring, reason: "seam redo", actor: admin })).ok, "reopen tailoring");
    assert((await statusOf(tailoring)) === OrderStageStatus.ACTIVE, "tailoring under way again");
    assert((await statusOf(await idOf(BespokeStage.ALTERATIONS))) === OrderStageStatus.DONE, "alterations keeps its completion");
    await complete(tailoring);

    await complete(await idOf(BespokeStage.FINAL_FITTING));
    assert((await lead()) === BespokeStage.DELIVERY, "delivery last");
    await pay(150_000, PaymentPurpose.BALANCE);
    await complete(await idOf(BespokeStage.DELIVERY));

    const final = await prisma.bespokeOrder.findUniqueOrThrow({ where: { id: order.id } });
    assert(final.status === OrderStatus.DELIVERED && final.deliveredAt, "order delivered");
    const end = await steps();
    assert(end.every((s) => s.status === OrderStageStatus.DONE || s.status === OrderStageStatus.SKIPPED), "every step settled");
    assert(end.find((s) => s.stage === BespokeStage.BEADING_FINISHING)!.status === OrderStageStatus.SKIPPED, "beading stayed skipped");
    assert(!(await edit({ action: "move", stepId: second, direction: "up" })).ok, "a delivered order's steps are closed");

    console.log("test-pipeline-walk: all assertions passed");
  } finally {
    await prisma
      .$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SELECT set_config('app.ledger_bypass', 'on', true)`);
        await tx.payment.deleteMany({ where: { bespokeOrderId: order.id } });
        await tx.bespokeOrder.delete({ where: { id: order.id } });
      })
      .catch((e) => console.warn("[flex walk cleanup]", e));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
