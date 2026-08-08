import { NextRequest, NextResponse } from "next/server";
import { AlterationPricing, AlterationStatus } from "@prisma/client";
import { FINANCE_ROLES, requireRoles } from "@/lib/api-auth";
import { triageAlterationRequest, updateAlterationStatus } from "@/lib/alterations/service";
import {
  getAlterationWarrantyDays,
  suggestAlterationPricing,
} from "@/lib/alterations/policy";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const gate = await requireRoles(FINANCE_ROLES);
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const item = await prisma.alterationRequest.findUnique({
    where: { id },
    include: {
      order: {
        select: {
          id: true,
          orderRef: true,
          clientName: true,
          clientEmail: true,
          deliveredAt: true,
          status: true,
        },
      },
    },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const warrantyDays = await getAlterationWarrantyDays();
  const pricingDefault = suggestAlterationPricing({
    reason: item.reason,
    deliveredAt: item.order.deliveredAt,
    warrantyDays,
  });

  return NextResponse.json({ item, warrantyDays, pricingDefault });
}

const triageSchema = z.object({
  action: z.enum(["ACCEPT", "DECLINE"]),
  pricingDecision: z.nativeEnum(AlterationPricing).optional(),
  pricingOverrideReason: z.string().max(2000).optional().nullable(),
  complimentaryEstimatedValue: z.number().optional().nullable(),
  declineReason: z.string().max(2000).optional().nullable(),
  quoteLineItems: z
    .array(
      z.object({
        description: z.string(),
        quantity: z.number(),
        unitPrice: z.number(),
        total: z.number(),
      }),
    )
    .optional(),
});

export async function POST(req: NextRequest, { params }: Params) {
  const gate = await requireRoles(FINANCE_ROLES);
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const parsed = triageSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const actorId = gate.session.user.id;
    if (!actorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const result = await triageAlterationRequest({
      alterationId: id,
      actorId,
      ...parsed.data,
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    const map: Record<string, number> = {
      NOT_FOUND: 404,
      NOT_REQUESTED: 400,
      OVERRIDE_REASON_REQUIRED: 400,
      ESTIMATED_VALUE_REQUIRED: 400,
    };
    return NextResponse.json({ error: msg }, { status: map[msg] ?? 500 });
  }
}

const statusSchema = z.object({
  status: z.nativeEnum(AlterationStatus),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const gate = await requireRoles(FINANCE_ROLES);
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const parsed = statusSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const item = await updateAlterationStatus({
      alterationId: id,
      status: parsed.data.status,
    });
    return NextResponse.json({ item });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 400 },
    );
  }
}
