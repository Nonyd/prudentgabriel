import { NextResponse } from "next/server";
import type { Measurement } from "@prisma/client";
import { requireSession } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/logger";
import { renderMeasurementsPdfBuffer } from "@/lib/render-measurements-pdf";

const LABELS: { key: keyof Measurement; label: string }[] = [
  { key: "bust", label: "Bust" },
  { key: "waist", label: "Waist" },
  { key: "hips", label: "Hips" },
  { key: "shoulderWidth", label: "Shoulder Width" },
  { key: "sleeveLength", label: "Sleeve Length" },
  { key: "dressLength", label: "Dress Length" },
  { key: "thigh", label: "Thigh" },
  { key: "inseam", label: "Inseam" },
  { key: "neck", label: "Neck" },
  { key: "armhole", label: "Armhole" },
];

export async function GET() {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  try {
    const profile = await prisma.clientProfile.findUnique({
      where: { userId: gate.session.user.id },
      include: {
        measurements: true,
        user: { select: { name: true } },
      },
    });

    const m = profile?.measurements;
    if (!m || !profile) {
      return NextResponse.json({ error: "No measurements saved" }, { status: 404 });
    }

    const unit = m.unit ?? "inches";
    const fields = LABELS.map(({ key, label }) => ({
      label,
      value: m[key] != null ? String(m[key]) : "—",
    }));

    const buf = await renderMeasurementsPdfBuffer({
      clientName: profile.user.name ?? "Client",
      unit,
      updatedAt: new Date(m.updatedAt).toLocaleDateString("en-GB"),
      fields,
      notes: m.notes,
    });

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="prudential-measurements.pdf"',
      },
    });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "MEASUREMENTS_PDF",
      message: e instanceof Error ? e.message : "PDF generation failed",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
