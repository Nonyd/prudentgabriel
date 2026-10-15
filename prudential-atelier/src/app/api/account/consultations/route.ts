import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { provenEmail } from "@/lib/email-verification";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = await provenEmail(session.user.id);
  const bookings = await prisma.consultationBooking.findMany({
    where: {
      OR: [{ userId: session.user.id }, ...(email ? [{ clientEmail: email }] : [])],
    },
    orderBy: { createdAt: "desc" },
    include: {
      consultant: { select: { name: true, image: true } },
      offering: {
        select: { sessionType: true, deliveryMode: true, durationMinutes: true },
      },
    },
  });

  return NextResponse.json({ bookings });
}
