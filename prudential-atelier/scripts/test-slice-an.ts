/**
 * Slice AN — stage media in state, honest checklist ticks, public approval token.
 *
 *   pnpm test:slice-an
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  BespokeStage,
  OrderStatus,
  Role,
  StageApprovalStatus,
  StageMediaKind,
} from "@prisma/client";
import { evaluateStageGate, type StageGateSnapshot } from "../src/lib/atelier/can-complete-stage";
import { getStageRequirement } from "../src/lib/atelier/stage-requirements";
import {
  buildStageChecklistFacts,
  mergeStageMedia,
  presentChecklistRow,
  presentStageChecklist,
} from "../src/lib/atelier/stage-checklist";
import { respondToStageApprovalByToken } from "../src/lib/atelier/stage-actions";
import {
  loadPublicStageApproval,
  publicStageApprovalOmitsClientRecord,
} from "../src/lib/public-stage-approval-payload";
import { generateBespokeOrderRef } from "../src/lib/bespoke-stages";
import { prisma } from "../src/lib/prisma";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

function snapshot(partial: Partial<StageGateSnapshot> & { currentStage: BespokeStage }): StageGateSnapshot {
  const stage = partial.currentStage;
  return {
    orderId: "ord_an",
    orderRef: "ORD-AN",
    productionUnlockedAt: new Date(),
    completedStages: [],
    notes: "notes",
    mediaCount: 1,
    latestApprovalStatus: null,
    balance: 0,
    requirement: getStageRequirement(stage),
    ...partial,
  };
}

function runPure() {
  const beadingFacts = buildStageChecklistFacts({
    currentStage: BespokeStage.BEADING_FINISHING,
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
    ],
    draftNotes: "beads in progress",
    mediaCount: 0,
    latestApprovalStatus: null,
    productionUnlockedAt: new Date(),
    balance: 2_769_231.23,
  });
  const beading = presentStageChecklist(beadingFacts);
  const approval = beading.find((r) => r.key === "approval")!;
  const balance = beading.find((r) => r.key === "balance")!;
  const media = beading.find((r) => r.key === "media")!;
  assert(approval.required === false, "beading does not require client approval");
  assert(approval.met === false, "no approval exists — the statement is unmet");
  assert(approval.mark !== "tick", "optional unmet approval must never render as a tick");
  assert(approval.displayLabel === "Not required at this stage", "optional unmet reads as not required");
  assert(balance.required === false, "beading does not require zero balance");
  assert(balance.met === false, "outstanding balance is not cleared");
  assert(balance.mark !== "tick", "optional unmet balance must never render as a tick");
  assert(balance.displayLabel === "Not required at this stage", "optional unmet balance is not a false tick");
  assert(media.required === true && media.met === false && media.mark === "open", "required unmet media stays an open circle");

  const afterUpload = mergeStageMedia(
    { currentStage: BespokeStage.BEADING_FINISHING, stageMedia: [] as { id: string; stage: string; url: string; kind: string }[] },
    [{ id: "m1", stage: BespokeStage.BEADING_FINISHING, url: "https://cdn.example/beading.jpg", kind: "IMAGE" }],
  );
  assert(afterUpload.stageMedia.length === 1, "POST items replace this stage's media in state");
  const mediaAfter = presentStageChecklist(
    buildStageChecklistFacts({
      currentStage: BespokeStage.BEADING_FINISHING,
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
      ],
      draftNotes: "beads in progress",
      mediaCount: afterUpload.stageMedia.filter((m) => m.stage === BespokeStage.BEADING_FINISHING).length,
      latestApprovalStatus: null,
      productionUnlockedAt: new Date(),
      balance: 2_769_231.23,
    }),
  ).find((r) => r.key === "media")!;
  assert(mediaAfter.met && mediaAfter.mark === "tick", "checklist updates from POST state without a reload");

  const optionalMet = presentChecklistRow({
    key: "approval",
    label: "Client approval received",
    required: false,
    met: true,
  });
  assert(optionalMet.mark === "tick" && optionalMet.displayLabel === "Client approval received", "optional-and-met reads as done");

  const falseTick = presentChecklistRow({
    key: "approval",
    label: "Client approval received",
    required: false,
    met: false,
  });
  assert(falseTick.mark !== "tick", "never a tick beside a false statement");

  const delivery = evaluateStageGate({
    snapshot: snapshot({
      currentStage: BespokeStage.DELIVERY,
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
      notes: "ready for collection",
      mediaCount: 1,
      productionUnlockedAt: new Date(),
      balance: 2_769_231.23,
      latestApprovalStatus: StageApprovalStatus.APPROVED,
    }),
    stage: BespokeStage.DELIVERY,
    actor: { id: "staff", role: Role.STAFF },
  });
  assert(!delivery.ok, "delivery with a balance must fail");
  assert(
    delivery.failures.some((f) => f.code === "OUTSTANDING_BALANCE"),
    `expected OUTSTANDING_BALANCE, got ${delivery.failures.map((f) => f.code).join(",")}`,
  );

  const clientSrc = readFileSync(resolve("src/components/admin/BespokeOrderDetailClient.tsx"), "utf8");
  assert(clientSrc.includes("mergeStageMedia"), "upload writes the POST body into order state");
  assert(clientSrc.includes("/api/bespoke/${order.id}/stage-draft"), "notes autosave so a reload does not discard them");
  assert(clientSrc.includes("seedNotesFromOrder"), "revert/complete re-seed notes from the returned order");
  const uploadFn = clientSrc.slice(clientSrc.indexOf("const handleUpload"), clientSrc.indexOf("const completeStage"));
  assert(!uploadFn.includes("router.refresh()"), "upload must not depend on router.refresh to update the checklist");

  const revertRoute = readFileSync(resolve("src/app/api/bespoke/[orderId]/revert-stage/route.ts"), "utf8");
  assert(revertRoute.includes("item"), "revert returns the updated order so the client can merge it");

  const accountSrc = readFileSync(
    resolve("src/components/account/BespokeApprovalClient.tsx"),
    "utf8",
  );
  assert(
    accountSrc.includes("/api/account/bespoke/${orderId}/approvals/${pending.id}"),
    "signed-in account approval route stays working",
  );

  const publicRoute = readFileSync(resolve("src/app/api/approve/[token]/route.ts"), "utf8");
  assert(!publicRoute.includes("requireSession"), "public token approval has no session gate");
  assert(publicRoute.includes("respondToStageApprovalByToken"), "public POST uses the token responder");

  const mw = readFileSync(resolve("src/middleware.ts"), "utf8");
  assert(mw.includes('pathname.startsWith("/approve")'), "public /approve is not account-gated");

  const welcome = readFileSync(resolve("src/emails/WelcomeCredentialsEmail.tsx"), "utf8");
  assert(welcome.includes("you do not need this password to approve a sketch"), "welcome email says what the account is for");
}

async function runToken() {
  const email = `an-token-${Date.now()}@example.com`;
  const user = await prisma.user.create({
    data: { email, name: "AN Token Client", role: Role.CUSTOMER, password: "x" },
  });
  const profile = await prisma.clientProfile.create({ data: { userId: user.id } });
  const order = await prisma.bespokeOrder.create({
    data: {
      orderRef: generateBespokeOrderRef(),
      clientProfileId: profile.id,
      clientName: "AN Token Client",
      clientEmail: email,
      currentStage: BespokeStage.FINAL_FITTING,
      status: OrderStatus.PROCESSING,
      totalAmount: 100_000,
      balance: 30_000,
    },
  });
  const approval = await prisma.stageApproval.create({
    data: {
      orderId: order.id,
      stage: BespokeStage.FINAL_FITTING,
      status: StageApprovalStatus.PENDING,
    },
  });
  await prisma.orderStageDraft.create({
    data: { orderId: order.id, stage: BespokeStage.FINAL_FITTING, notes: "Final fitting photograph for review." },
  });
  await prisma.orderStageMedia.create({
    data: {
      orderId: order.id,
      stage: BespokeStage.FINAL_FITTING,
      url: "https://cdn.example/fitting.jpg",
      kind: StageMediaKind.IMAGE,
    },
  });

  try {
    const payload = await loadPublicStageApproval(approval.publicToken);
    assert(payload, "public token loads a payload");
    assert(publicStageApprovalOmitsClientRecord(payload as unknown as Record<string, unknown>), "public DTO has no client record");
    assert(!("clientEmail" in (payload as object)), "payload object has no clientEmail key");
    assert(payload!.orderRef === order.orderRef, "payload shows the commission ref");
    assert(payload!.media.length === 1, "payload includes the photograph");
    assert(payload!.notes?.includes("Final fitting"), "payload includes atelier notes");

    const result = await respondToStageApprovalByToken({
      publicToken: approval.publicToken,
      decision: "APPROVED",
    });
    assert(result.ok, `token approval with no session must succeed: ${"error" in result ? result.error : ""}`);

    const after = await prisma.stageApproval.findUnique({ where: { id: approval.id } });
    assert(after?.status === StageApprovalStatus.APPROVED, "token approval marks the row APPROVED");

    const again = await respondToStageApprovalByToken({
      publicToken: approval.publicToken,
      decision: "APPROVED",
    });
    assert(!again.ok && again.status === 409, "a second token response is refused");
  } finally {
    await prisma.orderStageMedia.deleteMany({ where: { orderId: order.id } });
    await prisma.orderStageDraft.deleteMany({ where: { orderId: order.id } });
    await prisma.stageApproval.deleteMany({ where: { orderId: order.id } });
    await prisma.bespokeOrder.delete({ where: { id: order.id } });
    await prisma.clientProfile.delete({ where: { id: profile.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
}

async function main() {
  runPure();
  await runToken();
  console.log("OK — slice AN");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
