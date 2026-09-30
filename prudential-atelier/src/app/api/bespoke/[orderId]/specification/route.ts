import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBespokeAccess } from "@/lib/atelier/bespoke-access";
import {
  parseSpecItems,
  replaceSpecification,
  specificationInclude,
  specificationRows,
} from "@/lib/atelier/construction-features";
import { logActivity } from "@/lib/logger";

type Params = { params: Promise<{ orderId: string }> };

/** Slice BC2: what this gown is, as ticked construction features with their notes. */
export async function GET(_req: NextRequest, { params }: Params) {
  const gate = await requireBespokeAccess("read", { orderId: (await params).orderId });
  if (!gate.ok) return gate.response;
  const { orderId } = await params;
  const order = await prisma.bespokeOrder.findUnique({
    where: { id: orderId },
    select: { id: true, ...specificationInclude },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ items: specificationRows(order.features) });
}

/** Replace the specification. Managers only, like editing the commission itself. */
export async function PUT(req: NextRequest, { params }: Params) {
  const gate = await requireBespokeAccess("manage", { orderId: (await params).orderId });
  if (!gate.ok) return gate.response;
  const { orderId } = await params;

  const parsed = parseSpecItems(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const order = await prisma.bespokeOrder.findUnique({
    where: { id: orderId },
    select: { id: true, orderRef: true },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await replaceSpecification(orderId, parsed.items, gate.session.user.id ?? null);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  await logActivity({
    userId: gate.session.user.id,
    userEmail: gate.session.user.email ?? undefined,
    userRole: gate.session.user.role ?? undefined,
    action: "UPDATE",
    module: "bespoke",
    description: `Updated the specification for ${order.orderRef}`,
    recordId: orderId,
    recordType: "BespokeOrder",
  });

  const fresh = await prisma.bespokeOrder.findUnique({
    where: { id: orderId },
    select: { ...specificationInclude },
  });
  return NextResponse.json({ items: specificationRows(fresh?.features ?? []) });
}
