import { NextRequest, NextResponse } from "next/server";
import { PaymentMethod, PaymentPurpose, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/logger";
import { getClientIp } from "@/lib/rate-limit";
import { bespokeView, requireBespokeAccess } from "@/lib/atelier/bespoke-access";
import {
  appendPayment,
  getOrderPaymentSummary,
  inferBespokePurpose,
  resolveClientId,
  toNumber,
  recomputeOrderTotals,
} from "@/lib/payments/ledger";
import { generatePaymentReference } from "@/lib/payments/index";
import { stageGateInclude } from "@/lib/atelier/can-complete-stage";
import { canSeeOrderMeasurements, redactBespokeOrder } from "@/lib/bespoke-data-access";
import { parseDeliveryDateInput } from "@/lib/atelier/delivery-month";
import { specificationInclude } from "@/lib/atelier/construction-features";
import { addCommissionMaterial, parseMaterialInput } from "@/lib/atelier/commission-materials";

type Params = { params: Promise<{ orderId: string }> };

const paymentInclude = {
  payments: {
    orderBy: { createdAt: "desc" as const },
    include: { confirmedBy: { select: { id: true, name: true, email: true } } },
  },
};

export async function GET(_req: NextRequest, { params }: Params) {
  const { orderId } = await params;
  // The `bespoke` key, or STAFF assigned to this commission.
  const gate = await requireBespokeAccess("read", { orderId });
  if (!gate.ok) return gate.response;

  try {
    const order = await prisma.bespokeOrder.findUnique({
      where: { id: orderId },
      include: {
        stageHistory: { orderBy: { completedAt: "desc" } },
        assignments: {
          include: { staffProfile: { include: { user: { select: { id: true, name: true, email: true } } } } },
        },
        materials: { orderBy: { createdAt: "asc" } },
        clientProfile: { include: { measurements: true, moodboards: true } },
        quotation: true,
        ...paymentInclude,
        ...specificationInclude,
        ...stageGateInclude(),
      },
    });
    if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
    // Slice AZ8: payments/receipts for money roles; measurements for whoever cuts the garment.
    const view = bespokeView(gate.facts);
    const access = {
      payments: view.money,
      materialCost: view.materialCost,
      measurements: await canSeeOrderMeasurements(gate.session.user, order.id),
    };
    const summary = await getOrderPaymentSummary(order.id);
    const totalDrift = Math.abs(order.totalAmount - toNumber(summary.total)) > 0.005;
    const unlockDrift = Boolean(order.productionUnlockedAt) !== summary.depositSatisfied;
    if (totalDrift || unlockDrift) {
      await recomputeOrderTotals(order.id);
      const refreshed = await prisma.bespokeOrder.findUnique({
        where: { id: orderId },
        include: {
          stageHistory: { orderBy: { completedAt: "desc" } },
          assignments: {
            include: { staffProfile: { include: { user: { select: { id: true, name: true, email: true } } } } },
          },
          materials: { orderBy: { createdAt: "asc" } },
          clientProfile: { include: { measurements: true, moodboards: true } },
          quotation: true,
          ...paymentInclude,
          ...specificationInclude,
          ...stageGateInclude(),
        },
      });
      if (refreshed) return NextResponse.json({ item: redactBespokeOrder(refreshed, access) });
    }
    return NextResponse.json({ item: redactBespokeOrder(order, access) });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "BESPOKE_GET",
      message: e instanceof Error ? e.message : "Failed to fetch order",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { orderId } = await params;
  const gate = await requireBespokeAccess("manage", { orderId });
  if (!gate.ok) return gate.response;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if ("currentStage" in body) {
    return NextResponse.json(
      { error: "Stage changes must go through complete-stage or revert-stage." },
      { status: 422 },
    );
  }

  // BC3: the expected delivery date — set, moved, or cleared ("" / null).
  let deliveryDate: Date | null | undefined;
  if ("deliveryDate" in body) {
    const raw = body.deliveryDate;
    deliveryDate = parseDeliveryDateInput(typeof raw === "string" ? raw.slice(0, 10) : raw);
    if (deliveryDate === undefined) {
      return NextResponse.json({ error: "Delivery date must be a date" }, { status: 400 });
    }
  }

  // BD1: her event day — not the delivery date.
  let eventDate: Date | null | undefined;
  if ("eventDate" in body) {
    const raw = body.eventDate;
    eventDate = parseDeliveryDateInput(typeof raw === "string" ? raw.slice(0, 10) : raw);
    if (eventDate === undefined) {
      return NextResponse.json({ error: "Event date must be a date" }, { status: 400 });
    }
  }
  // BD1: the house's own title; "" or null goes back to the composed one.
  const title =
    "title" in body ? (typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0, 160) : null) : undefined;
  let garmentTypeId: string | null | undefined;
  let garmentRetired = false;
  if ("garmentTypeId" in body) {
    garmentTypeId = typeof body.garmentTypeId === "string" && body.garmentTypeId ? body.garmentTypeId : null;
    if (garmentTypeId) {
      const g = await prisma.garmentType.findUnique({ where: { id: garmentTypeId }, select: { archivedAt: true } });
      if (!g) return NextResponse.json({ error: "Unknown garment type" }, { status: 400 });
      garmentRetired = Boolean(g.archivedAt);
    }
  }

  try {
    const existing = await prisma.bespokeOrder.findUnique({ where: { id: orderId } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    // A retired type may stay on a commission that has it, but not be newly chosen (as BC2 features).
    if (garmentRetired && garmentTypeId !== existing.garmentTypeId) {
      return NextResponse.json({ error: "That garment type has been retired" }, { status: 400 });
    }

    const totalAmount =
      typeof body.totalAmount === "number" ? body.totalAmount : existing.totalAmount;

    // Prices and payments stay with money roles (AZ8), whoever else may edit the commission.
    const touchesMoney =
      totalAmount !== existing.totalAmount ||
      (typeof body.amountPaid === "number" && body.amountPaid !== existing.amountPaid);
    if (touchesMoney && !gate.facts.money) {
      return NextResponse.json(
        { error: "Prices and payments are kept for managers and finance." },
        { status: 403 },
      );
    }

    // Legacy clients may send amountPaid as a running total — convert delta into a ledger row.
    if (typeof body.amountPaid === "number" && body.amountPaid !== existing.amountPaid) {
      const delta = Math.round((body.amountPaid - existing.amountPaid) * 100) / 100;
      if (delta > 0) {
        const summary = await getOrderPaymentSummary(orderId);
        const purpose = inferBespokePurpose({
          amount: delta,
          balanceBefore: toNumber(summary.balance),
          depositRequired: toNumber(summary.depositRequired),
          confirmedBefore: toNumber(summary.confirmed),
        });
        const clientId = await resolveClientId({ email: existing.clientEmail });
        await appendPayment({
          reference: generatePaymentReference("MANUAL"),
          amount: delta,
          method: PaymentMethod.MANUAL,
          status: PaymentStatus.CONFIRMED,
          purpose: purpose as PaymentPurpose,
          bespokeOrderId: orderId,
          clientId,
          confirmedById: gate.session.user?.id ?? null,
          confirmedAt: new Date(),
        });
      }
    }

    if (body.material && typeof body.material === "object") {
      // BD3: one writer for materials (also POST /api/bespoke/:id/materials).
      const parsed = parseMaterialInput(body.material, bespokeView(gate.facts).materialCost);
      if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
      const added = await addCommissionMaterial(orderId, parsed.input, { id: gate.session.user.id! });
      if (!added.ok) return NextResponse.json({ error: added.error }, { status: added.status });
    }

    await prisma.bespokeOrder.update({
      where: { id: orderId },
      data: {
        clientName: typeof body.clientName === "string" ? body.clientName : undefined,
        clientEmail: typeof body.clientEmail === "string" ? body.clientEmail : undefined,
        clientPhone: typeof body.clientPhone === "string" ? body.clientPhone : undefined,
        outfitDescription:
          typeof body.outfitDescription === "string" ? body.outfitDescription : undefined,
        occasionType: typeof body.occasionType === "string" ? body.occasionType : undefined,
        eventLocation: typeof body.eventLocation === "string" ? body.eventLocation : undefined,
        clientLocation: typeof body.clientLocation === "string" ? body.clientLocation : undefined,
        deliveryDate,
        eventDate,
        title,
        garmentTypeId,
        outfitBrief: typeof body.outfitBrief === "string" ? body.outfitBrief : undefined,
        occasionDetails: typeof body.occasionDetails === "string" ? body.occasionDetails : undefined,
        notes: typeof body.notes === "string" ? body.notes : undefined,
        totalAmount,
        // amountPaid / balance / currentStage are not writable here.
        // Stage changes go through canCompleteStage / revertOrderStage.
      },
    });

    if (totalAmount !== existing.totalAmount) {
      await recomputeOrderTotals(orderId);
    }

    const refreshed = await prisma.bespokeOrder.findUnique({
      where: { id: orderId },
      include: paymentInclude,
    });

    // BD4: an edit returns what a GET would, not the payment ledger to a non-money role.
    const view = bespokeView(gate.facts);
    return NextResponse.json({
      item: refreshed
        ? redactBespokeOrder(refreshed, { payments: view.money, materialCost: view.materialCost, measurements: false })
        : null,
    });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "BESPOKE_PATCH",
      message: e instanceof Error ? e.message : "Failed to update order",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * Delete a commission and what goes with it (notes, materials, cost sheets,
 * payments …) — Slice AC's cascade. The typed DELETE is required whenever
 * anything goes with it; payments make it Super Admin only. Logged with counts.
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const { orderId } = await params;
  const gate = await requireBespokeAccess("admin", { orderId });
  if (!gate.ok) return gate.response;
  const body = (await req.json().catch(() => ({}))) as { confirmation?: string };
  try {
    const { executeCommissionCascade } = await import("@/lib/commission-cascade-delete");
    const result = await executeCommissionCascade({
      orderId,
      confirmation: body.confirmation,
      actor: {
        userId: gate.session.user.id!,
        email: gate.session.user.email ?? null,
        role: gate.role,
        ip: getClientIp(req),
      },
    });
    return NextResponse.json({ success: true, logId: result.logId, counts: result.preview.counts });
  } catch (e) {
    const { ProductCascadeError } = await import("@/lib/product-cascade-delete");
    if (e instanceof ProductCascadeError) return NextResponse.json({ error: e.message }, { status: e.status });
    await logError({ severity: "WARNING", errorType: "BESPOKE_DELETE", message: e instanceof Error ? e.message : "Delete failed" });
    return NextResponse.json({ error: "Delete failed; nothing was removed" }, { status: 500 });
  }
}
