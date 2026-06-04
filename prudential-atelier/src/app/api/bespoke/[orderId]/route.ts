import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/logger";
import { BESPOKE_ROLES, requireRoles } from "@/lib/api-auth";

type Params = { params: Promise<{ orderId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const gate = await requireRoles(BESPOKE_ROLES);
  if (!gate.ok) return gate.response;

  const { orderId } = await params;
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
      },
    });
    if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ item: order });
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
  const gate = await requireRoles(BESPOKE_ROLES);
  if (!gate.ok) return gate.response;

  const { orderId } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const existing = await prisma.bespokeOrder.findUnique({ where: { id: orderId } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const totalAmount =
      typeof body.totalAmount === "number" ? body.totalAmount : existing.totalAmount;
    const amountPaid = typeof body.amountPaid === "number" ? body.amountPaid : existing.amountPaid;

    if (body.material && typeof body.material === "object") {
      const m = body.material as {
        name?: string;
        quantity?: string | null;
        unitCost?: number | null;
        totalCost?: number | null;
        supplier?: string | null;
        notes?: string | null;
      };
      if (m.name) {
        await prisma.material.create({
          data: {
            orderId,
            name: m.name,
            quantity: m.quantity ?? null,
            unitCost: m.unitCost ?? null,
            totalCost: m.totalCost ?? m.unitCost ?? null,
            supplier: m.supplier ?? null,
            notes: m.notes ?? null,
          },
        });
      }
    }

    const updated = await prisma.bespokeOrder.update({
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
        deliveryDate: body.deliveryDate ? new Date(String(body.deliveryDate)) : undefined,
        notes: typeof body.notes === "string" ? body.notes : undefined,
        totalAmount,
        amountPaid,
        balance: totalAmount - amountPaid,
      },
    });

    return NextResponse.json({ item: updated });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "BESPOKE_PATCH",
      message: e instanceof Error ? e.message : "Failed to update order",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const gate = await requireRoles(BESPOKE_ROLES);
  if (!gate.ok) return gate.response;

  const { orderId } = await params;
  try {
    await prisma.bespokeOrder.delete({ where: { id: orderId } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
