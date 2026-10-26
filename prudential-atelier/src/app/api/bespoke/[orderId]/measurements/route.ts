import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireBespokeAccess } from "@/lib/atelier/bespoke-access";
import { canSeeOrderMeasurements } from "@/lib/bespoke-data-access";
import { cleanMeasurementInput } from "@/lib/measurements";
import { commissionMeasurements, parseSnapshot, snapshotFrom } from "@/lib/atelier/commission-measurements";
import { logActivity } from "@/lib/logger";
import { mergeAtelierExtras, readAtelierMeasurementFields, textFieldKeys } from "@/lib/atelier/measurement-fields";

type Params = { params: Promise<{ orderId: string }> };

async function gate(orderId: string) {
  const g = await requireBespokeAccess("work", { orderId });
  if (!g.ok) return g;
  // AZ8: managers, and the tailor or pattern cutter on this gown.
  if (!(await canSeeOrderMeasurements(g.session.user, orderId))) {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return g;
}

/** BD6: the set this commission is cut to — or her latest, labelled with its date. */
export async function GET(_req: NextRequest, { params }: Params) {
  const { orderId } = await params;
  const g = await gate(orderId);
  if (!g.ok) return g.response;
  const order = await prisma.bespokeOrder.findUnique({
    where: { id: orderId },
    select: { measurementsSnapshot: true, measurementsTakenAt: true, clientProfile: { select: { measurements: true } } },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ item: commissionMeasurements(order, order.clientProfile?.measurements ?? null) });
}

/**
 * BD6: take (or adjust) this commission's measurements. Starts from what it
 * already has, else from her latest set; writes both the commission's own set
 * and her latest, so the next commission starts from these.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { orderId } = await params;
  const g = await gate(orderId);
  if (!g.ok) return g.response;

  const cleaned = cleanMeasurementInput(
    await req.json().catch(() => null),
    textFieldKeys(await readAtelierMeasurementFields()),
  );
  if (!cleaned.ok) {
    return NextResponse.json({ error: cleaned.error, fieldErrors: cleaned.fieldErrors }, { status: 400 });
  }

  const order = await prisma.bespokeOrder.findUnique({
    where: { id: orderId },
    select: {
      status: true,
      clientProfileId: true,
      measurementsSnapshot: true,
      clientProfile: { select: { measurements: true } },
    },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (order.status === "ARCHIVED") {
    return NextResponse.json({ error: "Archived commissions are read-only." }, { status: 409 });
  }

  const start = parseSnapshot(order.measurementsSnapshot) ?? snapshotFrom(order.clientProfile?.measurements ?? null);
  const next = { ...start, ...cleaned.data, values: mergeAtelierExtras(start.values, cleaned.extra) };
  // Her latest set keeps its other values (the shop's custom-size extras) and takes these atelier ones.
  const profileValues = mergeAtelierExtras(order.clientProfile?.measurements?.values, cleaned.extra);
  const takenAt = new Date();

  await prisma.$transaction([
    prisma.bespokeOrder.update({
      where: { id: orderId },
      data: { measurementsSnapshot: next as Prisma.InputJsonValue, measurementsTakenAt: takenAt },
    }),
    ...(order.clientProfileId
      ? [
          prisma.measurement.upsert({
            where: { clientId: order.clientProfileId },
            create: { clientId: order.clientProfileId, ...cleaned.data, values: profileValues },
            update: { ...cleaned.data, values: profileValues },
          }),
        ]
      : []),
  ]);

  await logActivity({
    userId: g.session.user.id,
    userEmail: g.session.user.email ?? undefined,
    userRole: g.session.user.role ?? undefined,
    action: "UPDATE",
    module: "bespoke",
    description: `Took measurements for commission ${orderId}`,
    recordId: orderId,
    recordType: "BespokeOrder",
  });

  const fresh = await prisma.bespokeOrder.findUniqueOrThrow({
    where: { id: orderId },
    select: { measurementsSnapshot: true, measurementsTakenAt: true, clientProfile: { select: { measurements: true } } },
  });
  return NextResponse.json({ item: commissionMeasurements(fresh, fresh.clientProfile?.measurements ?? null) });
}
