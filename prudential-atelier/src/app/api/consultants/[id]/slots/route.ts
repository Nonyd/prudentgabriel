import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAvailableSlots, getWatTomorrowYmd, ymdCompare } from "@/lib/consultation";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: consultantId } = await params;
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const offeringId = searchParams.get("offeringId");
  if (!date || !offeringId) {
    return NextResponse.json({ error: "date and offeringId required" }, { status: 400 });
  }

  const consultant = await prisma.consultant.findUnique({
    where: { id: consultantId },
    select: { isFlagship: true },
  });
  if (!consultant) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (consultant.isFlagship) {
    return NextResponse.json({ slots: [], isManualFlow: true, date, consultantId });
  }

  const tomorrow = getWatTomorrowYmd();
  if (ymdCompare(date, tomorrow) < 0) {
    return NextResponse.json({ error: "Date must be from tomorrow onward" }, { status: 400 });
  }

  const offering = await prisma.consultantOffering.findFirst({
    where: { id: offeringId, consultantId, isActive: true },
    select: { durationMinutes: true },
  });
  if (!offering) {
    return NextResponse.json({ error: "Offering not found" }, { status: 404 });
  }

  const slots = await getAvailableSlots(consultantId, date, offering.durationMinutes);
  return NextResponse.json({ slots, date, consultantId, isManualFlow: false });
}
