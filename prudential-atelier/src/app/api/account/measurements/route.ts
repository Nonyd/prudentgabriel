import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/api-auth";
import { getOrCreateClientProfile } from "@/lib/account-helpers";
import { prisma } from "@/lib/prisma";
import { logActivity, logError } from "@/lib/logger";

const measurementSchema = z.object({
  bust: z.number().positive().optional().nullable(),
  waist: z.number().positive().optional().nullable(),
  hips: z.number().positive().optional().nullable(),
  shoulderWidth: z.number().positive().optional().nullable(),
  sleeveLength: z.number().positive().optional().nullable(),
  dressLength: z.number().positive().optional().nullable(),
  thigh: z.number().positive().optional().nullable(),
  inseam: z.number().positive().optional().nullable(),
  neck: z.number().positive().optional().nullable(),
  armhole: z.number().positive().optional().nullable(),
  unit: z.enum(["inches", "cm"]).optional(),
  notes: z.string().nullable().optional(),
});

export async function GET() {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  try {
    const profile = await getOrCreateClientProfile(gate.session.user.id!);
    const measurements = await prisma.measurement.findUnique({ where: { clientId: profile.id } });
    return NextResponse.json({ measurements });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "ACCOUNT_MEASUREMENTS_GET",
      message: e instanceof Error ? e.message : "Failed to get measurements",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = measurementSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const profile = await getOrCreateClientProfile(gate.session.user.id!);
    const data = parsed.data;

    const item = await prisma.measurement.upsert({
      where: { clientId: profile.id },
      create: { clientId: profile.id, ...data },
      update: data,
    });

    await logActivity({
      userId: gate.session.user.id,
      userEmail: gate.session.user.email ?? undefined,
      action: "UPDATE",
      module: "account",
      description: "Updated measurements",
      recordId: item.id,
      recordType: "Measurement",
    });

    return NextResponse.json({ measurements: item });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "ACCOUNT_MEASUREMENTS_PATCH",
      message: e instanceof Error ? e.message : "Failed to update measurements",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
