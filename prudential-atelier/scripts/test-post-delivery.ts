/**
 * Post-delivery loop tests (Sprint D).
 *
 *   pnpm test:post-delivery
 */
import {
  AlterationPricing,
  AlterationReason,
  AlterationStatus,
  OrderStatus,
  Role,
} from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { confirmBespokeReceipt, ReceiptConfirmError } from "../src/lib/bespoke-receipt";
import { completeOrderStage } from "../src/lib/atelier/stage-actions";
import { suggestAlterationPricing } from "../src/lib/alterations/policy";
import { triageAlterationRequest, createAlterationRequest } from "../src/lib/alterations/service";
import { maybeSendBespokeReviewRequest } from "../src/lib/bespoke-review";
import { generateBespokeOrderRef } from "../src/lib/bespoke-stages";

process.env.E2E_CAPTURE_EMAIL = "1";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

async function main() {
  const email = `pd-test-${Date.now()}@example.com`;
  const user = await prisma.user.create({
    data: {
      email,
      name: "PD Test Client",
      role: Role.CUSTOMER,
      password: "x",
    },
  });
  const profile = await prisma.clientProfile.create({
    data: { userId: user.id },
  });
  const staff = await prisma.user.create({
    data: {
      email: `pd-staff-${Date.now()}@example.com`,
      name: "PD Staff",
      role: Role.ADMIN,
      password: "x",
    },
  });

  const order = await prisma.bespokeOrder.create({
    data: {
      orderRef: generateBespokeOrderRef(),
      clientProfileId: profile.id,
      clientName: "PD Test Client",
      clientEmail: email,
      currentStage: "FINAL_FITTING",
      status: OrderStatus.PROCESSING,
      totalAmount: 100_000,
      balance: 5_000,
    },
  });

  const altIds: string[] = [];

  try {
    let blocked = false;
    try {
      await confirmBespokeReceipt({
        orderId: order.id,
        actor: { id: user.id, role: Role.CUSTOMER, email },
      });
    } catch (e) {
      blocked = e instanceof ReceiptConfirmError && e.status === 400;
    }
    assert(blocked, "undelivered receipt confirm must fail");

    await prisma.bespokeOrder.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.DELIVERED,
        deliveredAt: new Date(),
        currentStage: "DELIVERY",
      },
    });

    let staffBlocked = false;
    try {
      await confirmBespokeReceipt({
        orderId: order.id,
        actor: { id: staff.id, role: Role.ADMIN, email: staff.email },
      });
    } catch (e) {
      staffBlocked = e instanceof ReceiptConfirmError && e.status === 403;
    }
    assert(staffBlocked, "staff cannot confirm receipt");

    assert(
      suggestAlterationPricing({
        reason: AlterationReason.FIT,
        deliveredAt: new Date(),
        warrantyDays: 30,
      }) === AlterationPricing.FREE,
      "FIT within warranty → FREE",
    );
    assert(
      suggestAlterationPricing({
        reason: AlterationReason.CHANGE_REQUESTED,
        deliveredAt: new Date(),
        warrantyDays: 30,
      }) === AlterationPricing.CHARGEABLE,
      "CHANGE_REQUESTED → CHARGEABLE",
    );

    const alt = await createAlterationRequest({
      orderId: order.id,
      clientUserId: user.id,
      description: "Hem needs a small adjustment after delivery.",
      reason: AlterationReason.FIT,
    });
    altIds.push(alt.id);

    let estBlocked = false;
    try {
      await triageAlterationRequest({
        alterationId: alt.id,
        action: "ACCEPT",
        pricingDecision: AlterationPricing.FREE,
        actorId: staff.id,
      });
    } catch (e) {
      estBlocked = e instanceof Error && e.message === "ESTIMATED_VALUE_REQUIRED";
    }
    assert(estBlocked, "FREE accept requires estimated value");

    await triageAlterationRequest({
      alterationId: alt.id,
      action: "ACCEPT",
      pricingDecision: AlterationPricing.FREE,
      complimentaryEstimatedValue: 12_000,
      actorId: staff.id,
    });

    await confirmBespokeReceipt({
      orderId: order.id,
      actor: { id: user.id, role: Role.CUSTOMER, email },
    });
    const after = await prisma.bespokeOrder.findUnique({ where: { id: order.id } });
    assert(after?.receiptConfirmedAt, "receiptConfirmedAt set");
    assert(after?.receiptConfirmedById === user.id, "receiptConfirmedById is client");
    assert(after?.status !== OrderStatus.ARCHIVED, "open alteration blocks archive");

    const sent1 = await maybeSendBespokeReviewRequest(order.id);
    assert(sent1, "review send once");
    const sent2 = await maybeSendBespokeReviewRequest(order.id);
    assert(sent2, "second call still true (already sent)");
    const o2 = await prisma.bespokeOrder.findUnique({ where: { id: order.id } });
    assert(o2?.reviewRequestSent === true, "reviewRequestSent marker");

    await prisma.alterationRequest.update({
      where: { id: alt.id },
      data: { status: AlterationStatus.COMPLETED, resolvedAt: new Date() },
    });
    await prisma.bespokeOrder.update({
      where: { id: order.id },
      data: { balance: 0 },
    });
    const { maybeArchiveBespokeOrder } = await import("../src/lib/bespoke-archive");
    await maybeArchiveBespokeOrder(order.id);
    const archived = await prisma.bespokeOrder.findUnique({ where: { id: order.id } });
    assert(archived?.status === OrderStatus.ARCHIVED, "order archived");

    const stageRes = await completeOrderStage({
      orderId: order.id,
      actor: { id: staff.id, role: Role.ADMIN, email: staff.email },
      notes: "should fail",
    });
    assert(stageRes.ok === false && stageRes.status === 400, "archived refuses stage complete");

    console.log("OK — post-delivery loop");
  } finally {
    if (altIds.length) {
      await prisma.alterationRequest.deleteMany({ where: { id: { in: altIds } } });
    }
    await prisma.bespokeOrder.deleteMany({ where: { id: order.id } });
    await prisma.clientProfile.deleteMany({ where: { id: profile.id } });
    await prisma.user.deleteMany({ where: { id: { in: [user.id, staff.id] } } });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
