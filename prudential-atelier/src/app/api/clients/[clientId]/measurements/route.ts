import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BESPOKE_ROLES, requireRoles } from "@/lib/api-auth";
import { logActivity, logError } from "@/lib/logger";

type Params = { params: Promise<{ clientId: string }> };

type MeasurementInput = {
  bust?: number | null;
  waist?: number | null;
  hips?: number | null;
  shoulderWidth?: number | null;
  sleeveLength?: number | null;
  dressLength?: number | null;
  thigh?: number | null;
  inseam?: number | null;
  neck?: number | null;
  armhole?: number | null;
  unit?: string;
  notes?: string | null;
};

function parseOptionalFloat(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const gate = await requireRoles(BESPOKE_ROLES);
  if (!gate.ok) return gate.response;

  const { clientId } = await params;

  let body: MeasurementInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const client = await prisma.clientProfile.findUnique({ where: { id: clientId } });
    if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const data = {
      bust: parseOptionalFloat(body.bust),
      waist: parseOptionalFloat(body.waist),
      hips: parseOptionalFloat(body.hips),
      shoulderWidth: parseOptionalFloat(body.shoulderWidth),
      sleeveLength: parseOptionalFloat(body.sleeveLength),
      dressLength: parseOptionalFloat(body.dressLength),
      thigh: parseOptionalFloat(body.thigh),
      inseam: parseOptionalFloat(body.inseam),
      neck: parseOptionalFloat(body.neck),
      armhole: parseOptionalFloat(body.armhole),
      unit: typeof body.unit === "string" ? body.unit : undefined,
      notes: body.notes === undefined ? undefined : body.notes?.trim() || null,
    };

    const cleaned = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== undefined),
    );

    const item = await prisma.measurement.upsert({
      where: { clientId },
      create: { clientId, ...cleaned },
      update: cleaned,
    });

    await logActivity({
      userId: gate.session.user.id,
      userEmail: gate.session.user.email ?? undefined,
      userRole: gate.session.user.role ?? undefined,
      action: "UPDATE",
      module: "clients",
      description: `Updated measurements for client ${clientId}`,
      recordId: item.id,
      recordType: "Measurement",
    });

    return NextResponse.json({ item });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "CLIENT_MEASUREMENTS",
      message: e instanceof Error ? e.message : "Failed to update measurements",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
