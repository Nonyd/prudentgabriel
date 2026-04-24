import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = session.user.email.toLowerCase();
  const bookings = await prisma.consultationBooking.findMany({
    where: {
      OR: [{ userId: session.user.id }, { clientEmail: email }],
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
