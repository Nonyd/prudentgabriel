import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getNextAvailableDates } from "@/lib/consultation";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: consultantId } = await params;
  const { searchParams } = new URL(req.url);
  const durationRaw = searchParams.get("durationMinutes");
  const durationMinutes = durationRaw ? Math.max(15, Math.min(240, Number(durationRaw))) : 60;

  const consultant = await prisma.consultant.findUnique({
    where: { id: consultantId },
    select: { isFlagship: true },
  });
  if (!consultant) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (consultant.isFlagship) {
    return NextResponse.json({ dates: [], isManualFlow: true });
  }

  const dates = await getNextAvailableDates(consultantId, 60, durationMinutes);
  return NextResponse.json({ dates, consultantId });
}
