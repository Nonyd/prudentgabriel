import { NextRequest, NextResponse } from "next/server";
import { ConsultationEnquiryStatus } from "@prisma/client";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

/** BA2 queue: pending first, oldest first — the one waiting longest is on top. */
export async function GET(req: NextRequest) {
  const gate = await requireAdminApi("consultations");
  if (!gate.ok) return gate.response;

  const raw = new URL(req.url).searchParams.get("status");
  const status =
    raw && (Object.values(ConsultationEnquiryStatus) as string[]).includes(raw)
      ? (raw as ConsultationEnquiryStatus)
      : ConsultationEnquiryStatus.PENDING;

  const items = await prisma.consultationEnquiry.findMany({
    where: { status },
    orderBy: status === ConsultationEnquiryStatus.PENDING ? { createdAt: "asc" } : { updatedAt: "desc" },
    take: 200,
    select: {
      id: true,
      enquiryNumber: true,
      clientName: true,
      clientEmail: true,
      clientPhone: true,
      eventDate: true,
      eventType: true,
      wearer: true,
      outfitType: true,
      notes: true,
      moodboardImages: true,
      shortNotice: true,
      status: true,
      decisionReason: true,
      decidedAt: true,
      decidedBy: true,
      publicTokenExpiresAt: true,
      bookingId: true,
      booking: { select: { bookingNumber: true } },
      createdAt: true,
    },
  });
  return NextResponse.json({ items });
}
