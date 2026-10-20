import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { canSeeClientMeasurements } from "@/lib/bespoke-data-access";
import { logActivity, logError } from "@/lib/logger";
import { cleanMeasurementInput } from "@/lib/measurements";
import { mergeAtelierExtras } from "@/lib/atelier/measurement-fields";

type Params = { params: Promise<{ clientId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  const { clientId } = await params;

  // Slice AZ8: only whoever cuts this client's garments (or a manager) records measurements.
  if (!(await canSeeClientMeasurements(gate.session.user, clientId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const cleanedInput = cleanMeasurementInput(body);
  if (!cleanedInput.ok) {
    return NextResponse.json({ error: cleanedInput.error, fieldErrors: cleanedInput.fieldErrors }, { status: 400 });
  }
  const cleaned = cleanedInput.data;
  const extra = cleanedInput.extra;

  try {
    const client = await prisma.clientProfile.findUnique({ where: { id: clientId } });
    if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const existing = await prisma.measurement.findUnique({ where: { clientId }, select: { values: true } });
    // The atelier extras join her other values (the shop's custom-size ones are kept).
    const values = mergeAtelierExtras(existing?.values, extra);
    const item = await prisma.measurement.upsert({
      where: { clientId },
      create: { clientId, ...cleaned, values },
      update: { ...cleaned, values },
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
