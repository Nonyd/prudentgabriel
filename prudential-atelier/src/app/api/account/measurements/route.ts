import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/api-auth";
import { getOrCreateClientProfile } from "@/lib/account-helpers";
import { prisma } from "@/lib/prisma";
import { logActivity, logError } from "@/lib/logger";
import { profileMeasurementProblems } from "@/lib/measurements";

const figure = z
  .number({ error: "Please enter a number" })
  .positive("Must be greater than zero")
  .optional()
  .nullable();

const measurementSchema = z.object({
  bust: figure,
  waist: figure,
  hips: figure,
  shoulderWidth: figure,
  sleeveLength: figure,
  dressLength: figure,
  thigh: figure,
  inseam: figure,
  neck: figure,
  armhole: figure,
  unit: z.enum(["inches", "cm"]).optional(),
  notes: z.string().max(2000, "Notes are too long (2,000 characters at most)").nullable().optional(),
});

const LABELS: Record<string, string> = {
  bust: "Bust",
  waist: "Waist",
  hips: "Hips",
  shoulderWidth: "Shoulder width",
  sleeveLength: "Sleeve length",
  dressLength: "Dress length",
  thigh: "Thigh",
  inseam: "Inseam",
  neck: "Neck",
  armhole: "Armhole",
  unit: "Unit",
  notes: "Notes",
};

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
    return NextResponse.json({ error: "We could not read that form — please try again." }, { status: 400 });
  }

  const parsed = measurementSchema.safeParse(body);
  if (!parsed.success) {
    // One sentence she can act on, plus the field it belongs to — never a raw zod object.
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fieldErrors[key]) fieldErrors[key] = `${LABELS[key] ?? key}: ${issue.message.toLowerCase()}`;
    }
    const first = Object.values(fieldErrors)[0] ?? "Some figures could not be read — please check them.";
    return NextResponse.json({ error: first, fieldErrors }, { status: 400 });
  }

  const problems = profileMeasurementProblems(parsed.data);
  if (problems) {
    return NextResponse.json(problems, { status: 400 });
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
    return NextResponse.json({ error: "Your measurements could not be saved just now. Please try again in a moment." }, { status: 500 });
  }
}
